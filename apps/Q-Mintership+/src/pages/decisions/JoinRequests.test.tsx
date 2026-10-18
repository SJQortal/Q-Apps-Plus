/**
 * Requested to join MINTER Group (Simon, 2026-10-18: the Ready to mint list,
 * renamed and moved into + Propose → Decline a join request, a page of its
 * own): who asked to join, for Minter Admins to decline from. The list's
 * order, its reads (only the rows on screen), former members, its search, and
 * declining from a row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DECLINED, addDecline, fakeAddress, type World } from '../../../e2e/world.mjs';
import { formatDate, shortAddress } from '../../utils/format';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { base58Decode, base58Encode } from '../../qortal/base58';
import { invalidate } from '../../data/query';
import { ADDR, MS_PER_BLOCK, NOW, TIP } from '../../test/world';
import { proposePath } from '../../routes/paths';
import DecisionsPage from './DecisionsPage';
import ProposePage from './propose/ProposePage';
import { SUBMIT_LABEL } from './propose/proposePageWords';

afterEach(() => vi.useRealTimers());
vi.setConfig({ testTimeout: 30_000 });

const T = { timeout: 4000 };

/** + Propose → Decline a join request, as a Minter Admin (in `sort`'s order). */
async function open(setup?: (world: World) => void, sort?: string) {
  const rendered = await renderPage(<ProposePage />, {
    persona: 'admin',
    path: proposePath('decline'),
    route: '/propose/:kind',
    setup,
  });
  const user = userEvent.setup();
  await screen.findByRole('heading', { level: 1, name: 'Decline a join request' }, T);
  const dialog = document.body;
  if (sort) await user.selectOptions(await within(dialog).findByLabelText('Sort', {}, T), sort);
  return { ...rendered, dialog };
}

const joinRequest = (joiner: string) => ({ groupId: 694, joiner });

const readyList = () => screen.findByRole('list', { name: 'Requested to join MINTER Group' }, T);

/** A row, found by the name (or short address) its person link shows. */
async function row(label: string): Promise<HTMLElement> {
  const link = await within(await readyList()).findByRole(
    'link',
    { name: `${label}: open their page` },
    T
  );
  return link.closest('li') as HTMLElement;
}

function rowLabels(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('link', { name: /: open their page$/ })
    .map((a) => a.getAttribute('aria-label')?.replace(/: open their page$/, '') ?? '');
}

/** The list reads again when the nominations do (every minute, or Refresh on Decisions). */
const nominationsRefresh = () => act(() => invalidate('nominations:'));

describe('Requested to join MINTER Group', () => {
  it('lists who asked to join, in the node’s order, without members or banned', async () => {
    await open((world) => {
      world.joinRequests.push(
        joinRequest(ADDR.kicked),
        joinRequest(ADDR.learner),
        joinRequest(ADDR.banned),
        joinRequest(fakeAddress('old-ban'))
      );
    }, 'node');
    const kit = await row('Kit Kicked');
    expect(
      await within(kit).findByText(/^Level 3 · 210,000 blocks minted/, {}, { timeout: 4000 })
    ).toBeInTheDocument();
    const list = await readyList();
    await waitFor(() => expect(rowLabels(list)).toContain('bob+builder'));
    expect(rowLabels(list)).toEqual([
      'bob+builder',
      'Uma Urgent',
      'Mia Met',
      shortAddress(fakeAddress('jr-1')),
      shortAddress(fakeAddress('jr-2')),
      shortAddress(fakeAddress('jr-3')),
      'Kit Kicked',
      // A ban that ran out: ready again. The member and the banned account are left out.
      shortAddress(fakeAddress('old-ban')),
    ]);
    expect(
      await within(await row('bob+builder')).findByText(/^Level 0 · no blocks minted yet/)
    ).toBeInTheDocument();
    // Kit was a member once: the row says so, from their MINTER history.
    expect(
      await within(kit).findByText(
        'Former member: removed from MINTER on 26 Aug 2026',
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(within(await row('bob+builder')).queryByText(/Former member/)).toBeNull();
    expect(screen.getByText(/People who asked to join MINTER and aren.t members\./)).toBeVisible();
    expect(screen.getByLabelText('Sort')).toHaveValue('node');
    expect(screen.getByText('8 of 8 shown')).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: 'Search who asked to join MINTER, by name or address' })
    ).toBeInTheDocument();
    // Decline where no nomination is open; nothing to nominate or support from here.
    expect(
      await within(await row('Uma Urgent')).findByText('Nominated', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(within(list).getAllByRole('button')).toHaveLength(5);
    expect(
      within(list)
        .getAllByRole('button')
        .every((b) => /^Decline .*’s join request$/.test(b.getAttribute('aria-label') ?? ''))
    ).toBe(true);
  });

  it('shows 20 at a time and reads accounts and names only for the rows shown', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 45 }, (_, i) => fakeAddress(`many-jr-${i}`));
    await open((world) => {
      world.joinRequests.push(...many.map(joinRequest));
    }, 'node');
    const list = await readyList();
    // 6 from the mock world, then 14 of these.
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(20));
    expect(screen.getByText('20 of 51 shown')).toBeInTheDocument();
    // Account and name: two reads per row shown, none for the others. (Every row's MINTER
    // history is read once for the list's first order, newest request first: see below.)
    const reads = (address: string) =>
      fetchCallsFor(`/addresses/${address}`).length +
      fetchCallsFor(`/names/primary/${address}`).length;
    await waitFor(() => expect(reads(many[13])).toBe(2));
    expect(many.slice(0, 14).map(reads)).toEqual(new Array(14).fill(2));
    expect(many.slice(14).map(reads)).toEqual(new Array(31).fill(0));

    await user.click(screen.getByRole('button', { name: 'Show 20 more' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(40);
    // Focus moves to the first new row.
    expect(document.activeElement).toHaveAccessibleName(
      `${shortAddress(many[14])}: open their page`
    );
    await waitFor(() => expect(reads(many[33])).toBe(2));
    expect(many.slice(14, 34).map(reads)).toEqual(new Array(20).fill(2));
    expect(many.slice(34).map(reads)).toEqual(new Array(11).fill(0));
    // Rows already read aren't read again.
    expect(many.slice(0, 14).map(reads)).toEqual(new Array(14).fill(2));

    await user.click(screen.getByRole('button', { name: 'Show 11 more' }));
    expect(within(list).getAllByRole('listitem')).toHaveLength(51);
    expect(screen.getByText('51 of 51 shown')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull();
  });

  /** Three people who asked to join on given days, at given levels, and one with no record. */
  function sortWorld(world: World) {
    const people = [
      { key: 'sort-ann', name: 'Ann Early', level: 4, blocks: 90_000, days: 40 },
      { key: 'sort-zed', name: 'Zed Recent', level: 1, blocks: 5_000, days: 2 },
      { key: 'sort-meg', name: 'Meg Middle', level: 6, blocks: 400_000, days: 15 },
      { key: 'sort-nil', name: 'Nil Unknown', level: 2, blocks: 20_000, days: null },
    ];
    for (const p of people) {
      const address = fakeAddress(p.key);
      world.accounts.set(address, {
        address,
        name: p.name,
        level: p.level,
        blocks: p.blocks,
        publicKey: base58Encode(new Uint8Array(32).fill(p.level + 1)),
        reference: 'x',
        balance: 1,
      });
      world.names.set(p.name, address);
      world.joinRequests.push(joinRequest(address));
      if (p.days === null) continue;
      world.decided.push({
        type: 'JOIN_GROUP',
        timestamp: NOW - p.days * 86_400_000,
        reference: `r-join-${p.key}`,
        fee: '0.01000000',
        signature: `join-${p.key}`,
        txGroupId: 0,
        blockHeight: TIP - Math.round((p.days * 86_400_000) / MS_PER_BLOCK),
        approvalStatus: 'NOT_REQUIRED',
        creatorAddress: address,
        groupId: 694,
      });
    }
  }
  const SORTED = ['Ann Early', 'Zed Recent', 'Meg Middle', 'Nil Unknown'];
  const orderOf = async () => {
    const list = await readyList();
    await waitFor(() => expect(rowLabels(list)).toEqual(expect.arrayContaining(SORTED)));
    return rowLabels(list).filter((label) => SORTED.includes(label));
  };

  it('sorts by when they asked, newest first by default, with the date on each row', async () => {
    const user = userEvent.setup();
    await open(sortWorld);
    expect(await screen.findByLabelText('Sort')).toHaveValue('newest');
    // Unknown dates go last.
    await waitFor(async () =>
      expect(await orderOf()).toEqual(['Zed Recent', 'Meg Middle', 'Ann Early', 'Nil Unknown'])
    );
    expect(
      await within(await row('Zed Recent')).findByText(
        `Level 1 · 5,000 blocks minted · asked ${formatDate(NOW - 2 * 86_400_000)}`,
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Sort'), 'Oldest request first');
    await waitFor(async () =>
      expect(await orderOf()).toEqual(['Ann Early', 'Meg Middle', 'Zed Recent', 'Nil Unknown'])
    );
    await user.selectOptions(screen.getByLabelText('Sort'), 'Highest level');
    await waitFor(async () =>
      expect(await orderOf()).toEqual(['Meg Middle', 'Ann Early', 'Nil Unknown', 'Zed Recent'])
    );
    await user.selectOptions(screen.getByLabelText('Sort'), 'Most blocks minted');
    await waitFor(async () =>
      expect(await orderOf()).toEqual(['Meg Middle', 'Ann Early', 'Nil Unknown', 'Zed Recent'])
    );
    await user.selectOptions(screen.getByLabelText('Sort'), 'Name (A–Z)');
    await waitFor(async () =>
      expect(await orderOf()).toEqual(['Ann Early', 'Meg Middle', 'Nil Unknown', 'Zed Recent'])
    );
  });

  it('sorting by date reads each history once; accounts and names only for the rows shown', async () => {
    const many = Array.from({ length: 45 }, (_, i) => fakeAddress(`sorted-jr-${i}`));
    await open((world) => {
      world.joinRequests.push(...many.map(joinRequest));
    });
    const list = await readyList();
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(20));
    const history = (address: string) =>
      fetchCallsFor(`/transactions/search?address=${address}`).length;
    const details = (address: string) =>
      fetchCallsFor(`/addresses/${address}`).length +
      fetchCallsFor(`/names/primary/${address}`).length;
    // Every row's history, for the order: one read each.
    await waitFor(() => expect(many.map(history)).toEqual(new Array(45).fill(1)));
    // Accounts and names: none for the rows not shown.
    const shownRows = new Set(rowLabels(list));
    const hidden = many.filter((a) => !shownRows.has(shortAddress(a)));
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.map(details)).toEqual(new Array(hidden.length).fill(0));
  });

  it('marks former members, kicked, banned or left, and nobody who was never a member', async () => {
    let banEnded = 0;
    await open((world) => {
      world.joinRequests.push(joinRequest(ADDR.left), joinRequest(ADDR.kicked));
      // Bram's 3-day ban ended: a former member again, and the row says it was a ban.
      const ban = world.decided.find((tx: { type: string }) => tx.type === 'GROUP_BAN');
      ban.timeToLive = 3 * 86_400;
      banEnded = ban.timestamp + 3 * 86_400_000;
      world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ADDR.banned);
      world.joinRequests.push(joinRequest(ADDR.banned));
    });
    expect(
      await within(await row('Lou Left')).findByText(
        /^Former member: left MINTER on \d+ \w+ 2026$/,
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(
      await within(await row('Kit Kicked')).findByText(
        'Former member: removed from MINTER on 26 Aug 2026'
      )
    ).toBeInTheDocument();
    // A kick stays "removed from MINTER"; a ban that ended says so, with its end.
    expect(
      await within(await row('Bram Banned')).findByText(
        `Former member: banned, ban ended on ${formatDate(banEnded)}`
      )
    ).toBeInTheDocument();
    const list = await readyList();
    // The others never were members.
    await waitFor(() => expect(within(list).getAllByText(/^Former member: /)).toHaveLength(3));
  });

  it('never marks a declined join request as a removal from MINTER', async () => {
    await open((world) => {
      const { declined } = addDecline(world);
      const kick = world.decided.find(
        (tx: { signature: string }) => tx.signature === declined.kick
      );
      // Kit, removed on 26 Aug 2026, asked again and was declined too.
      world.decided.push(
        { ...kick, signature: `${kick.signature.slice(0, -4)}KitD`, member: ADDR.kicked },
        ...[DECLINED.address, ADDR.kicked].map((who, i) => ({
          type: 'JOIN_GROUP',
          timestamp: kick.timestamp - 86_400_000 * (i + 2),
          signature: `${kick.signature.slice(0, -4)}Jn${i}x`,
          txGroupId: 0,
          blockHeight: kick.blockHeight - 2_000 * (i + 1),
          approvalStatus: 'NOT_REQUIRED',
          creatorAddress: who,
          groupId: 694,
        })),
        // Both asked again since.
        ...[DECLINED.address, ADDR.kicked].map((who, i) => ({
          type: 'JOIN_GROUP',
          timestamp: kick.timestamp + 86_400_000 * (i + 2),
          signature: `${kick.signature.slice(0, -4)}Ag${i}x`,
          txGroupId: 0,
          blockHeight: kick.approvalHeight + 1_000 * (i + 1),
          approvalStatus: 'NOT_REQUIRED',
          creatorAddress: who,
          groupId: 694,
        }))
      );
      world.joinRequests.push(joinRequest(DECLINED.address), joinRequest(ADDR.kicked));
    });
    const dee = await row(DECLINED.name);
    expect(
      await within(await row('Kit Kicked')).findByText(
        'Former member: removed from MINTER on 26 Aug 2026',
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchCallsFor(`/transactions/search?address=${DECLINED.address}`)).toHaveLength(1)
    );
    expect(within(dee).queryByText(/Former member/)).toBeNull();
  });

  it('says when a former member’s ban was lifted', async () => {
    let liftedAt = 0;
    await open((world) => {
      const ban = world.decided.find((tx: { type: string }) => tx.type === 'GROUP_BAN');
      world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ADDR.banned);
      const lift = {
        ...ban,
        type: 'CANCEL_GROUP_BAN',
        signature: `${ban.signature.slice(0, -4)}Lift`,
        member: ban.offender,
        offender: undefined,
        timeToLive: undefined,
        blockHeight: ban.approvalHeight + 1000,
        approvalHeight: ban.approvalHeight + 1500,
      };
      world.decided.push(lift);
      // When block approvalHeight was, as the app dates it from the tip.
      liftedAt = NOW - (TIP - lift.approvalHeight) * MS_PER_BLOCK;
      world.joinRequests.push(joinRequest(ADDR.banned));
    });
    expect(
      await within(await row('Bram Banned')).findByText(
        `Former member: ban lifted on ${formatDate(liftedAt)}`,
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
  });

  it('reads a row again when the list refreshes, when its level could not be read', async () => {
    let down = true;
    await open((world) => {
      world.joinRequests.push(joinRequest(ADDR.kicked));
      mockFetchRoute(`/addresses/${ADDR.kicked}`, () =>
        down
          ? new Response('', { status: 500 })
          : { address: ADDR.kicked, level: 3, blocksMinted: 210_000 }
      );
    });
    const kit = await row('Kit Kicked');
    expect(
      await within(kit).findByText('Level not available right now', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    const reads = () => fetchCallsFor(`/addresses/${ADDR.kicked}`).length;
    const others = () => fetchCallsFor(`/addresses/${fakeAddress('jr-1')}`).length;
    const [kitBefore, othersBefore] = [reads(), others()];

    // Two minutes later the node answers again.
    down = false;
    vi.setSystemTime(Date.now() + 2 * 60_000);
    await nominationsRefresh();
    expect(
      await within(await row('Kit Kicked')).findByText(
        'Level 3 · 210,000 blocks minted',
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(reads()).toBe(kitBefore + 1);
    // Rows read a moment ago aren't read again.
    expect(others()).toBe(othersBefore);
  });

  it('reads a failed row again once per list refresh, not each time another row comes near', async () => {
    // Rows come near only when the test says so, one at a time, as when scrolling.
    const watchers = new Map<Element, IntersectionObserverCallback>();
    class OneAtATime {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        watchers.set(target, this.callback);
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', OneAtATime);
    const comeNear = (target: Element) =>
      act(() =>
        watchers.get(target)?.(
          [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      );
    const later = Array.from({ length: 8 }, (_, i) => fakeAddress(`near-jr-${i}`));
    try {
      await open((world) => {
        world.joinRequests.push(joinRequest(ADDR.kicked), ...later.map(joinRequest));
        mockFetchRoute(`/addresses/${ADDR.kicked}`, () => new Response('', { status: 500 }));
      });
      // Not near yet: nothing is read, so the row shows the short address.
      const kit = await row(shortAddress(ADDR.kicked));
      expect(fetchCallsFor(`/addresses/${ADDR.kicked}`)).toHaveLength(0);
      await comeNear(kit);
      expect(
        await within(kit).findByText('Level not available right now', {}, { timeout: 4000 })
      ).toBeInTheDocument();
      const reads = () => fetchCallsFor(`/addresses/${ADDR.kicked}`).length;
      const before = reads();
      // Scrolling on: each row below comes near and is read, and Kit's failed row isn't.
      for (const address of later) {
        await comeNear(await row(shortAddress(address)));
        await waitFor(() => expect(fetchCallsFor(`/addresses/${address}`)).toHaveLength(1));
      }
      expect(reads()).toBe(before);

      // A refresh of the list reads it again, once.
      vi.setSystemTime(Date.now() + 2 * 60_000);
      await nominationsRefresh();
      await waitFor(() => expect(reads()).toBe(before + 1));
      await comeNear(await row(shortAddress(later[0])));
      expect(reads()).toBe(before + 1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('says so when no one has asked to join', async () => {
    await open((world) => {
      world.joinRequests.length = 0;
    });
    expect(
      await screen.findByText('No one has asked to join right now', {}, { timeout: 4000 })
    ).toBeInTheDocument();
  });

  it('shows an error with Retry, and loads on Retry', async () => {
    const user = userEvent.setup();
    let down = true;
    const { dialog } = await open(() =>
      mockFetchRoute('/groups/joinrequests/694', () =>
        down ? new Response('', { status: 500 }) : [joinRequest(fakeAddress('jr-1'))]
      )
    );
    expect(
      await screen.findByText('Couldn’t load who asked to join MINTER.', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    down = false;
    await user.click(within(dialog).getByRole('button', { name: 'Retry' }));
    expect(await row(shortAddress(fakeAddress('jr-1')))).toBeInTheDocument();
  });

  it('is for Minter Admins: nobody else has it, nor a tab of its own', async () => {
    await renderPage(<DecisionsPage />, {
      persona: 'nominator',
      path: '/decisions',
      route: '/decisions',
    });
    expect(await screen.findByRole('list', { name: 'Open nominations' }, T)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Propose' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Ready to mint|Requested to join/ })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Requested to join MINTER Group' })).toBeNull();
  });
});

describe('Requested to join MINTER Group: search', () => {
  const searchBox = () =>
    screen.getByRole('searchbox', { name: 'Search who asked to join MINTER, by name or address' });
  // Name searches and lookups (not a row's own primary name, or whether it has any name).
  const nameLookups = () => fetchCallsFor(/^\/names\/(?!primary\/|address\/)/);

  it('finds a typed address directly, without looking up any name', async () => {
    const user = userEvent.setup();
    await open((world) => {
      world.joinRequests.push(joinRequest(ADDR.kicked));
    });
    await row('Kit Kicked');
    await user.click(searchBox());
    await user.paste(ADDR.kicked);
    const list = await readyList();
    await waitFor(() => expect(rowLabels(list)).toEqual(['Kit Kicked']));
    expect(screen.getByText(`1 of 7 matches “${ADDR.kicked}”.`)).toBeInTheDocument();
    expect(nameLookups()).toHaveLength(0);
  });

  it('says so when a typed address isn’t on the list, and clears the search', async () => {
    const user = userEvent.setup();
    await open();
    await readyList();
    await user.click(searchBox());
    await user.paste(ADDR.learner);
    expect(
      await screen.findByText(
        `No one on this list matches “${ADDR.learner}”`,
        {},
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('This address hasn’t asked to join MINTER, or is a member already.')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(searchBox()).toHaveValue('');
    // The button went with the empty state: focus is on the search box, not lost.
    expect(searchBox()).toHaveFocus();
    await waitFor(async () => expect(rowLabels(await readyList())).toHaveLength(6));
  });

  it('matches part of an address, as the short address on a row shows it', async () => {
    const user = userEvent.setup();
    await open(() => {
      mockFetchRoute('/names/search', () => []);
    });
    const jr2 = fakeAddress('jr-2');
    await row(shortAddress(jr2));
    await user.type(searchBox(), jr2.slice(-6));
    await waitFor(async () => expect(rowLabels(await readyList())).toEqual([shortAddress(jr2)]));
  });

  it('resolves a typed name to its owner, without reading every row’s name', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 45 }, (_, i) => fakeAddress(`many-jr-${i}`));
    const searched: Array<string | null> = [];
    await open((world) => {
      // Lou is row 52: far below the first page, never read before the search.
      world.joinRequests.push(...many.map(joinRequest), joinRequest(ADDR.left));
      mockFetchRoute('/names/search', (url: URL) => {
        searched.push(url.searchParams.get('query'));
        return [
          { name: 'Lou Left', owner: ADDR.left },
          { name: 'Lou Elsewhere', owner: fakeAddress('not-ready') },
        ];
      });
    });
    const list = await readyList();
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(20));
    // The first page's rows are read (the 20th is many[13]).
    await waitFor(() => expect(fetchCallsFor(`/names/primary/${many[13]}`)).toHaveLength(1));
    const namesRead = fetchCallsFor('/names/primary/').length;

    await user.type(searchBox(), 'lou');
    // While the name is looked up nothing on the page matches: the list makes way for a skeleton.
    await waitFor(async () => expect(rowLabels(await readyList())).toEqual(['Lou Left']), {
      timeout: 4000,
    });
    expect(screen.getByText('1 of 52 matches “lou”.')).toBeInTheDocument();
    // One small name search once typing paused; no exact lookup (the page had room).
    expect(searched).toEqual(['lou']);
    expect(fetchCallsFor('/names/search')[0]).toMatch(/[?&]limit=10(&|$)/);
    expect(nameLookups()).toHaveLength(1);
    // Only Lou's own row was read; the 32 rows the search hid never were.
    await waitFor(() => expect(fetchCallsFor(`/names/primary/${ADDR.left}`)).toHaveLength(1));
    expect(fetchCallsFor('/names/primary/')).toHaveLength(namesRead + 1);
    expect(many.slice(14).flatMap((a) => fetchCallsFor(`/names/primary/${a}`))).toEqual([]);
  });

  it('looks up the exact name when the name search page is full without it', async () => {
    const user = userEvent.setup();
    await open((world) => {
      world.joinRequests.push(joinRequest(ADDR.left));
      mockFetchRoute('/names/search', () =>
        Array.from({ length: 10 }, (_, i) => ({
          name: `Lou Left ${i + 1}`,
          owner: fakeAddress(`lou-${i}`),
        }))
      );
    });
    await row('Lou Left');
    await user.type(searchBox(), 'Lou Left');
    await waitFor(async () => expect(rowLabels(await readyList())).toEqual(['Lou Left']));
    expect(fetchCallsFor('/names/Lou%20Left')).toHaveLength(1);
  });

  it('still matches names already shown when the name search fails', async () => {
    const user = userEvent.setup();
    await open((world) => {
      world.joinRequests.push(joinRequest(ADDR.kicked));
      mockFetchRoute('/names/search', () => new Response('', { status: 500 }));
    });
    await row('Kit Kicked');
    await user.type(searchBox(), 'kit');
    await waitFor(async () => expect(rowLabels(await readyList())).toEqual(['Kit Kicked']), {
      timeout: 4000,
    });
    expect(
      await screen.findByText(
        '1 of 7 matches “kit”. Names couldn’t be looked up just now, so only addresses and names already shown count.'
      )
    ).toBeInTheDocument();
  });

  it('says what to try when nothing matches', async () => {
    const user = userEvent.setup();
    await open(() => {
      mockFetchRoute('/names/search', () => []);
    });
    await readyList();
    await user.type(searchBox(), 'zzz');
    expect(
      await screen.findByText('No one on this list matches “zzz”', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Try their full registered name, or their address.')
    ).toBeInTheDocument();
    // The search's own status region says it too, worded apart from the empty state.
    expect(
      screen
        .getAllByRole('status')
        .some((el) => /^None of \d+ match “zzz”\.$/.test(el.textContent ?? ''))
    ).toBe(true);
  });
});

describe('Requested to join MINTER Group: declining', () => {
  const declineButtons = async () =>
    within(await readyList()).queryAllByRole('button', { name: /^Decline .*’s join request$/ });

  it('offers Decline where no nomination is open', async () => {
    await open();
    const jr1 = await row(shortAddress(fakeAddress('jr-1')));
    expect(
      await within(jr1).findByRole(
        'button',
        { name: `Decline ${shortAddress(fakeAddress('jr-1'))}’s join request` },
        { timeout: 4000 }
      )
    ).toHaveTextContent('Decline');
    // jr-1, jr-2 and jr-3: the others have a nomination open.
    expect(await declineButtons()).toHaveLength(3);
    const uma = await row('Uma Urgent');
    expect(within(uma).queryByRole('button')).toBeNull();
    expect(within(uma).getByText('Nominated')).toBeVisible();
  });

  it('says so where a decline is waiting, with a link to it', async () => {
    let signature = '';
    await open((world) => {
      signature = addDecline(world).waiting.signature;
    });
    const jr2 = await row(shortAddress(fakeAddress('jr-2')));
    const link = await within(jr2).findByRole(
      'link',
      {
        name: `A decline is waiting for Minter Admins’ approvals: open the decision about ${shortAddress(fakeAddress('jr-2'))}`,
      },
      { timeout: 4000 }
    );
    expect(link).toHaveTextContent('A decline is waiting for Minter Admins’ approvals');
    expect(link).toHaveAttribute('href', `/decisions/${signature}`);
    expect(within(jr2).queryByRole('button')).toBeNull();
  });

  it('a Minter Admin picks a row, gives a reason, and proposes and approves it in two Hub steps', async () => {
    const user = userEvent.setup();
    const jr1 = fakeAddress('jr-1');
    const { world, address, publicKey, dialog } = await open((w) => void addDecline(w));
    const signature = base58Encode(new Uint8Array(64).fill(9));
    mockQortalRequest('KICK_FROM_GROUP', (req: Record<string, unknown>) => {
      const tx = {
        type: 'GROUP_KICK',
        timestamp: Date.now(),
        reference: base58Encode(new Uint8Array(64).fill(1)),
        signature,
        txGroupId: 694,
        groupId: 694,
        approvalStatus: 'PENDING',
        creatorAddress: address,
        adminPublicKey: publicKey,
        member: req.qortalAddress,
        reason: req.reason,
      };
      world.pending.push(tx);
      return tx;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN' }));

    const label = shortAddress(jr1);
    await user.click(
      await within(await row(label)).findByRole(
        'button',
        { name: `Decline ${label}’s join request` },
        { timeout: 4000 }
      )
    );
    // The person is picked, and checked; the list has made way for the reason.
    expect(
      await within(dialog).findByText('Nothing stops this proposal.', {}, { timeout: 4000 })
    ).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Requested to join MINTER Group' })).toBeNull();
    const next = screen.getByRole('region', { name: 'What happens next' });
    expect(next).toHaveTextContent(
      'Once it passes their join request is gone. They can send a new join request later.'
    );
    expect(within(next).getByText(/^Fees in total: 0\.02 QORT/)).toBeVisible();
    // A note for the Minter Admins is one more Hub step, and the fees say so.
    const noteBox = within(dialog).getByRole('textbox', {
      name: 'Note for the Minter Admins (optional)',
    });
    await user.type(noteBox, 'Asked twice in Q-Chat.');
    expect(within(next).getByText(/Your note follows\./)).toBeVisible();
    expect(within(next).getByText(/^Fees in total: 0\.03 QORT \(3 × 0\.01 QORT\)/)).toBeVisible();
    await user.clear(noteBox);
    expect(within(next).getByText(/^Fees in total: 0\.02 QORT/)).toBeVisible();
    // A reason is required.
    const submit = screen.getByRole('button', { name: SUBMIT_LABEL.decline.named(label) });
    await user.click(submit);
    expect(within(dialog).getByRole('textbox', { name: 'Reason' })).toHaveFocus();
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Reason' }),
      'No node, asked twice'
    );
    await user.click(submit);

    const hub = await screen.findByRole(
      'dialog',
      { name: `Decline a join request: ${label}` },
      { timeout: 4000 }
    );
    expect(within(hub).getByText('Step 1 of 2: Propose it')).toBeVisible();
    expect(within(hub).getByText('Step 2 of 2: Approve it')).toBeVisible();
    expect(within(hub).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    expect(within(hub).getByText(/^Reason:/).parentElement).toHaveTextContent(
      'Reason: No node, asked twice'
    );
    await user.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(hub).findByText('Proposed and approved', {}, { timeout: 4000 })
    ).toBeVisible();
    expect(qortalCallsFor('KICK_FROM_GROUP')).toEqual([
      {
        action: 'KICK_FROM_GROUP',
        groupId: 694,
        qortalAddress: jr1,
        reason: 'No node, asked twice',
        txGroupId: 694,
      },
    ]);
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(signature);

    await user.click(within(hub).getByRole('button', { name: 'Done' }));
    // The page says it is proposed; Propose another: the list says the decline is on its way.
    expect(
      await screen.findByRole(
        'heading',
        { level: 2, name: `Proposed: Decline a join request: ${label}` },
        T
      )
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Decisions' })).toHaveAttribute(
      'href',
      '/decisions?show=declines'
    );
    await user.click(screen.getByRole('button', { name: 'Propose another' }));
    expect(
      await within(await row(label)).findByText('Decline sent ✓ (confirming…)', {}, T)
    ).toBeInTheDocument();
  }, 30_000);
});
