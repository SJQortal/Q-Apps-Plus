/**
 * One account in the Explorer: the account itself (header, chips, tabs),
 * a name in the URL swapped for its owner's address with a note, the
 * state pages (no such name, not a valid address, never used, an AT), the
 * trail across hops, Compare's 4-account limit, Recent explorations and
 * Refresh. Read-only: no POST, no write request to Hub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { getDefaultStore } from 'jotai';
import { renderPage } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { fetchCallsFor, mockFetchRoute, qortalCalls } from '../../test/setup';
import { ADDR } from '../../test/world';
import { explorerAccountPath } from '../../routes/paths';
import {
  addPick,
  comparePicksAtom,
  recentAtom,
  resetExplorerState,
  trailAtom,
} from '../../state/explorer';
import { motionAtom, SETTINGS_KEYS } from '../../state/settings';
import AccountPage from './AccountPage';

const T = { timeout: 4000 };
const ROUTE = '/explorer/account/:who/:tab?';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const store = getDefaultStore();
const AT = `A${'c'.repeat(33)}`;
/** Written like an address, but Core says its checksum is wrong. */
const BAD = `Q${'d'.repeat(33)}`;
/** A valid address no transaction ever involved. */
const FRESH = `Q${'e'.repeat(33)}`;

const NAMES: Record<string, string[]> = {
  [ADDR.nominator]: ['Nora Nominator', 'Q-Maps', 'Nora’s Shop'],
  [ADDR.learner]: ['Leo Learner'],
  [ADDR.admin]: ['Avery Admin'],
  [ADDR.newcomer]: ['Second Name'],
};

/** Where the app is now and how it got there, plus hops like Explorer links. */
function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  const hop = (address: string, via: boolean) =>
    navigate(explorerAccountPath(address), via ? { state: { via: 'explorer' } } : undefined);
  return (
    <>
      <output data-testid="at">
        {location.pathname}|{JSON.stringify(location.state ?? null)}|{type}
      </output>
      <button type="button" onClick={() => hop(ADDR.learner, true)}>
        hop to Leo
      </button>
      <button type="button" onClick={() => hop(ADDR.admin, true)}>
        hop to Avery
      </button>
      <button type="button" onClick={() => hop(ADDR.kicked, false)}>
        open Kit from elsewhere
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        go back
      </button>
    </>
  );
}

/** Core's answers to the Explorer's reads that the mock world doesn't give. */
function answerExplorerReads() {
  mockFetchRoute('/names/address/', (url: URL) => {
    const address = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    return (NAMES[address] ?? []).map((name) => ({ name, owner: address }));
  });
  mockFetchRoute('/addresses/online', [
    { minterAddress: ADDR.nominator, recipientAddress: ADDR.nominator, minterLevel: 6 },
  ]);
}

async function open(path: string, setup?: () => void, persona = 'learner', strict = false) {
  const result = await renderPage(
    <>
      <AccountPage />
      <Probe />
    </>,
    {
      persona,
      path,
      route: ROUTE,
      strict,
      // Newer than the world's own routes: these answer first.
      setup: () => {
        answerExplorerReads();
        setup?.();
      },
    }
  );
  return { ...result, user: userEvent.setup() };
}

const at = () => screen.getByTestId('at').textContent ?? '';
const note = () => screen.queryByRole('note');
/** A fact's value in the Overview (a dd after its dt). */
const fact = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent ?? '';

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

beforeEach(() => resetExplorerState());
const originalMatchMedia = window.matchMedia;
afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

/** A screen `width` px wide (and tall enough), for MUI's breakpoint queries. */
function screenWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
    const matches =
      sizes.length > 0 &&
      !/height/.test(query) &&
      sizes.every(([, edge, value]) =>
        edge === 'min' ? width >= Number(value) : width <= Number(value)
      );
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
}

describe('an account in the Explorer', () => {
  it('shows who it is, where it stands and its tabs; passes axe; writes nothing', async () => {
    const { container, posts } = await open(explorerAccountPath(ADDR.nominator));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T)
    ).toBeVisible();
    const about = screen.getByRole('list', { name: 'About this account' });
    expect(within(about).getByText('Level 6')).toBeInTheDocument();
    expect(await within(about).findByText('MINTER member', {}, T)).toBeInTheDocument();
    expect(await within(about).findByText('Minting now', {}, T)).toBeInTheDocument();
    expect(within(about).queryByText('Minting penalty')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy a link to this account' })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Account sections' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['Overview', 'Connections', 'Transactions', 'Mintership', 'Names']);
    expect(within(tabs).getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'owns 3 names' }, T)).toBeInTheDocument();
    expect(fact('Level')).toBe('6');
    await waitFor(() => expect(fact('Groups')).toBe('In 3 groups'), T);
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('says when an account has names but no primary name, or none at all', async () => {
    const first = await open(explorerAccountPath(ADDR.newcomer));
    expect(await screen.findByText('No primary name', {}, T)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Q\w{5}…\w{4}$/);
    first.unmount();
    await open(explorerAccountPath(ADDR.liftBan));
    expect(await screen.findByText('No registered name', {}, T)).toBeInTheDocument();
  });

  it('switches tabs in place: no new history entry, and focus stays on the tab', async () => {
    const { user } = await open(explorerAccountPath(ADDR.nominator));
    const tabs = await screen.findByRole('tablist', { name: 'Account sections' }, T);
    await user.click(within(tabs).getByRole('tab', { name: 'Names' }));
    // The Names tab's code loads first (the router waits for it in a transition).
    await waitFor(
      () => expect(at()).toBe(`/explorer/account/${ADDR.nominator}/names|null|REPLACE`),
      T
    );
    const names = within(tabs).getByRole('tab', { name: 'Names' });
    expect(names).toHaveAttribute('aria-selected', 'true');
    expect(names).toHaveFocus();
    const panel = await screen.findByRole('tabpanel', { name: 'Names' }, T);
    expect(await within(panel).findByRole('region', { name: 'Names (3)' }, T)).toBeInTheDocument();
    await user.click(within(tabs).getByRole('tab', { name: 'Overview' }));
    await waitFor(() => expect(at()).toBe(`/explorer/account/${ADDR.nominator}|null|REPLACE`), T);
    expect(within(tabs).getByRole('tab', { name: 'Overview' })).toHaveFocus();
  });

  it('starts a tab afresh for each account: Back to one keeps nothing asked on another', async () => {
    const { user, posts } = await open(
      explorerAccountPath(ADDR.nominator, 'connections'),
      undefined,
      'learner',
      true
    );
    const sponsorship = (address: string) => fetchCallsFor(`/addresses/sponsorship/${address}`);
    await screen.findByRole('button', { name: 'Load Core’s report' }, T);
    // To Leo by an Explorer link, then his Connections, where his report is asked for.
    await user.click(screen.getByRole('button', { name: 'hop to Leo' }));
    await screen.findByRole('heading', { level: 1, name: 'Leo Learner' }, T);
    const tabs = await screen.findByRole('tablist', { name: 'Account sections' }, T);
    await user.click(within(tabs).getByRole('tab', { name: 'Connections' }));
    await user.click(await screen.findByRole('button', { name: 'Load Core’s report' }, T));
    await waitFor(() => expect(sponsorship(ADDR.learner)).toHaveLength(1), T);
    // Back to Nora's Connections (already read, so the page stays): nothing asked on hers.
    await user.click(screen.getByRole('button', { name: 'go back' }));
    await waitFor(
      () => expect(at()).toBe(`/explorer/account/${ADDR.nominator}/connections|null|POP`),
      T
    );
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    expect(
      await screen.findByRole('button', { name: 'Load Core’s report' }, T)
    ).toBeInTheDocument();
    expect(sponsorship(ADDR.nominator)).toEqual([]);
    noWrites(posts);
  });

  it('opens an unknown tab segment on Overview', async () => {
    await open(`${explorerAccountPath(ADDR.nominator)}/wallet`);
    expect(await screen.findByRole('tab', { name: 'Overview' }, T)).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('Refresh reads this account again', async () => {
    const { user } = await open(explorerAccountPath(ADDR.nominator));
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    const reads = () => fetchCallsFor(`/addresses/${ADDR.nominator}`).length;
    const before = reads();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(reads()).toBeGreaterThan(before), T);
    // Only this account: another's reads are left alone.
    expect(fetchCallsFor(`/addresses/${ADDR.learner}`)).toEqual([]);
  });
});

describe('a name in the URL', () => {
  it('is swapped for its owner’s address, saying which of their names it was', async () => {
    await open('/explorer/account/Q-Maps', () =>
      mockFetchRoute('/names/Q-Maps', { name: 'Q-Maps', owner: ADDR.nominator })
    );
    await waitFor(
      () =>
        expect(at()).toBe(
          `/explorer/account/${ADDR.nominator}|{"viaName":"Q-Maps","matched":"Q-Maps"}|REPLACE`
        ),
      T
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T)
    ).toBeVisible();
    await waitFor(
      () =>
        expect(note()).toHaveTextContent(
          "Opened from the name “Q-Maps”, one of this account's 3 names."
        ),
      T
    );
  });

  it('says when Core matched another spelling, keeping the tab', async () => {
    await open('/explorer/account/q-maps/names', () =>
      mockFetchRoute('/names/q-maps', { name: 'Q-Maps', owner: ADDR.nominator })
    );
    await waitFor(
      () => expect(at()).toMatch(new RegExp(`^/explorer/account/${ADDR.nominator}/names\\|`)),
      T
    );
    await waitFor(
      () =>
        expect(note()).toHaveTextContent(
          "Opened from the name “q-maps”, one of this account's 3 names. Core matched “Q-Maps” (same letters, ignoring case and look-alikes)."
        ),
      T
    );
  });

  it('needs no note for the account’s own primary name', async () => {
    await open('/explorer/account/Nora%20Nominator');
    await waitFor(() => expect(at()).toMatch(`/explorer/account/${ADDR.nominator}|`), T);
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    await screen.findByRole('list', { name: 'About this account' }, T);
    expect(note()).toBeNull();
  });

  it('a name no one has: says so, lists names that contain it, and offers the field', async () => {
    const { posts } = await open('/explorer/account/Nobody Here', () =>
      mockFetchRoute('/names/search', [{ name: 'Nobody Here Too', owner: ADDR.learner }])
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'No such name' }, T)).toBeVisible();
    expect(screen.getByText('No one has the name', { exact: false })).toHaveTextContent(
      'No one has the name “Nobody Here”.'
    );
    const list = await screen.findByRole('list', { name: 'Names that contain “Nobody Here”' }, T);
    expect(within(list).getByRole('link', { name: /^Nobody Here Too/ })).toHaveAttribute(
      'href',
      explorerAccountPath(ADDR.learner)
    );
    expect(
      screen.getByRole('combobox', { name: 'Find an account or transaction' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(at()).toBe('/explorer/account/Nobody Here|null|POP');
    noWrites(posts);
  });
});

describe('the state pages', () => {
  it('an address Core rejects: not valid, a letter may be wrong', async () => {
    await open(explorerAccountPath(BAD), () =>
      mockFetchRoute(
        `/addresses/${BAD}`,
        () =>
          new Response(JSON.stringify({ error: 102, message: 'invalid address' }), {
            status: 400,
          })
      )
    );
    expect(
      await screen.findByText("This isn't a valid Qortal address. A letter may be wrong.", {}, T)
    ).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('a mistyped address that is no one’s name either: not valid', async () => {
    await open('/explorer/account/Q0OIl2345678901234567890xyz');
    expect(
      await screen.findByText("This isn't a valid Qortal address. A letter may be wrong.", {}, T)
    ).toBeInTheDocument();
  });

  it('a valid address never used: says so and reads nothing more', async () => {
    const { container } = await open(explorerAccountPath(FRESH), () =>
      mockFetchRoute(
        `/addresses/${FRESH}`,
        () =>
          new Response(JSON.stringify({ error: 124, message: 'account address unknown' }), {
            status: 404,
          })
      )
    );
    expect(
      await screen.findByText("This address hasn't been used on Qortal yet.", {}, T)
    ).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    for (const read of [
      '/names/address/',
      '/addresses/online',
      '/groups/member/',
      '/names/primary/' + FRESH,
    ])
      expect(fetchCallsFor(read)).toEqual([]);
    expect(store.get(recentAtom)).toEqual([]);
    await expectNoAxeViolations(container);
  });

  it('an AT address: an automated contract, with its transactions only', async () => {
    const { container } = await open(explorerAccountPath(AT));
    expect(await screen.findByRole('heading', { level: 1, name: 'AT address' }, T)).toBeVisible();
    expect(
      screen.getByText('An automated contract (AT), not a personal account.')
    ).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Account sections' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent)
    ).toEqual(['Transactions']);
    expect(await screen.findByRole('tabpanel', { name: 'Transactions' }, T)).toBeInTheDocument();
    expect(fetchCallsFor(`/addresses/${AT}`)).toEqual([]);
    await expectNoAxeViolations(container);
  });
});

describe('the trail', () => {
  it('grows with Explorer links, goes back to a crumb, and starts again from elsewhere', async () => {
    const { user } = await open(explorerAccountPath(ADDR.nominator));
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    // One account: no trail yet.
    expect(screen.queryByRole('navigation', { name: 'Your trail' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'hop to Leo' }));
    await waitFor(() => expect(store.get(trailAtom)).toEqual([ADDR.nominator, ADDR.learner]), T);
    await user.click(screen.getByRole('button', { name: 'hop to Avery' }));
    await waitFor(
      () => expect(store.get(trailAtom)).toEqual([ADDR.nominator, ADDR.learner, ADDR.admin]),
      T
    );
    const trail = await screen.findByRole('navigation', { name: 'Your trail' }, T);
    const crumbs = within(trail).getAllByRole('listitem');
    expect(crumbs).toHaveLength(3);
    expect(await within(crumbs[2]).findByText('Avery Admin', {}, T)).toBeInTheDocument();
    expect(crumbs[2].querySelector('[aria-current="page"]')).not.toBeNull();
    expect(within(crumbs[2]).queryByRole('link')).toBeNull();

    // Back to the first crumb: the rest is cut.
    await user.click(await within(crumbs[0]).findByRole('link', { name: /Nora Nominator/ }, T));
    await waitFor(() => expect(store.get(trailAtom)).toEqual([ADDR.nominator]), T);
    expect(screen.queryByRole('navigation', { name: 'Your trail' })).toBeNull();

    // Opened from outside the Explorer: a new trail.
    await user.click(screen.getByRole('button', { name: 'hop to Leo' }));
    await waitFor(() => expect(store.get(trailAtom)).toEqual([ADDR.nominator, ADDR.learner]), T);
    await user.click(screen.getByRole('button', { name: 'open Kit from elsewhere' }));
    await waitFor(() => expect(store.get(trailAtom)).toEqual([ADDR.kicked]), T);
    // Every account opened is remembered, newest first.
    expect(store.get(recentAtom)).toEqual([ADDR.kicked, ADDR.learner, ADDR.nominator, ADDR.admin]);
  });

  it('remembers nothing on this device when Settings say not to', async () => {
    window.localStorage.setItem(SETTINGS_KEYS.explorerRemember, 'false');
    await open(explorerAccountPath(ADDR.nominator));
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    expect(store.get(trailAtom)).toEqual([ADDR.nominator]);
    expect(store.get(recentAtom)).toEqual([]);
  });
});

describe('on a phone', () => {
  it('shows the whole name under the avatar, the title being cut short', async () => {
    screenWidth(360);
    const { posts } = await open(explorerAccountPath(ADDR.nominator), undefined, 'learner', true);
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    await screen.findByRole('list', { name: 'About this account' }, T);
    // Once in the title (one h1), once as plain text under the avatar.
    const [title, line] = screen.getAllByText('Nora Nominator');
    expect(title.closest('h1')).not.toBeNull();
    expect(line.tagName).toBe('BDI');
    expect(line).toHaveAttribute('dir', 'auto');
    expect(line.closest('h1, h2, h3')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    noWrites(posts);
  });

  it('carries the tabs in the sticky header and folds the middle of a long trail', async () => {
    screenWidth(390);
    // Four accounts opened one from another, Leo's last: opening his page keeps them.
    store.set(trailAtom, [ADDR.admin, ADDR.kicked, ADDR.nominator, ADDR.learner]);
    const { user } = await open(explorerAccountPath(ADDR.learner));
    await screen.findByRole('heading', { level: 1, name: 'Leo Learner' }, T);
    const header = screen.getByRole('banner');
    expect(
      await within(header).findByRole('tablist', { name: 'Account sections' }, T)
    ).toBeInTheDocument();
    const trail = await screen.findByRole('navigation', { name: 'Your trail' }, T);
    const more = within(trail).getByRole('button', { name: 'Show 2 more accounts in the trail' });
    expect(more).toHaveTextContent('2 more');
    await user.click(more);
    expect(within(trail).queryByRole('button', { name: /more accounts in the trail/ })).toBeNull();
    const crumbs = within(trail).getAllByRole('listitem');
    expect(crumbs).toHaveLength(4);
    // The button went: focus is on the first crumb it revealed, not lost.
    await waitFor(() => expect(within(crumbs[1]).getByRole('link')).toHaveFocus());
  });
});

describe('a tab switch deep in a long tab', () => {
  /** Where each tab panel's top is, as if the page were scrolled; the rest at 0. */
  let panelTop = 0;
  const scrolled: Array<{ id: string; options: unknown }> = [];

  beforeEach(() => {
    panelTop = 0;
    scrolled.length = 0;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const top = this.getAttribute('role') === 'tabpanel' ? panelTop : 0;
      return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top } as DOMRect;
    });
    Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
      scrolled.push({ id: this.id, options });
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('brings the new tab’s top into view on a phone, and stays put when it is on screen', async () => {
    screenWidth(390);
    const { user, posts } = await open(
      explorerAccountPath(ADDR.nominator),
      undefined,
      'learner',
      true
    );
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    const tabs = within(screen.getByRole('banner')).getByRole('tablist', {
      name: 'Account sections',
    });
    // Far down Overview, the header back: the next tab's top is above the screen.
    panelTop = -2400;
    await user.click(within(tabs).getByRole('tab', { name: 'Names' }));
    await screen.findByRole('tabpanel', { name: 'Names' }, T);
    await waitFor(
      () =>
        expect(scrolled).toEqual([
          { id: 'account-panel-names', options: { block: 'start', behavior: 'smooth' } },
        ]),
      T
    );
    expect(within(tabs).getByRole('tab', { name: 'Names' })).toHaveFocus();
    // Near the top already: no jump.
    panelTop = 300;
    await user.click(within(tabs).getByRole('tab', { name: 'Overview' }));
    await screen.findByRole('tabpanel', { name: 'Overview' }, T);
    expect(scrolled).toHaveLength(1);
    noWrites(posts);
  });

  it('jumps without the smooth scroll when motion is reduced', async () => {
    store.set(motionAtom, 'reduce');
    try {
      const { user } = await open(explorerAccountPath(ADDR.nominator), undefined, 'learner', true);
      const tabs = await screen.findByRole('tablist', { name: 'Account sections' }, T);
      panelTop = -800;
      await user.click(within(tabs).getByRole('tab', { name: 'Mintership' }));
      await screen.findByRole('tabpanel', { name: 'Mintership' }, T);
      await waitFor(
        () =>
          expect(scrolled).toEqual([
            { id: 'account-panel-mintership', options: { block: 'start', behavior: 'auto' } },
          ]),
        T
      );
    } finally {
      store.set(motionAtom, 'system');
    }
  });
});

describe('Compare from the account header', () => {
  const others = ['f', 'g', 'h', 'j'].map((c) => `Q${c.repeat(33)}`);

  it('refuses a 5th account, then adds one when there is room, with Compare now', async () => {
    for (const a of others) addPick(a);
    const { user } = await open(explorerAccountPath(ADDR.nominator));
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    const add = screen.getByRole('button', { name: 'Add Nora Nominator to compare' });
    expect(add).toHaveAttribute('aria-pressed', 'false');
    await user.click(add);
    expect(
      await screen.findByText('Compare holds 4 accounts. Remove one first.', {}, T)
    ).toBeVisible();
    expect(store.get(comparePicksAtom)).toEqual(others);

    store.set(comparePicksAtom, others.slice(0, 3));
    await user.click(screen.getByRole('button', { name: 'Add Nora Nominator to compare' }));
    expect(await screen.findByText('Added to compare (4 of 4)', {}, T)).toBeVisible();
    const remove = screen.getByRole('button', { name: 'Remove Nora Nominator from compare' });
    expect(remove).toHaveAttribute('aria-pressed', 'true');
    // The trail row offers Compare too, to the same accounts.
    expect(screen.getByRole('link', { name: 'Compare 4' })).toHaveAttribute(
      'href',
      `/explorer/compare/${[...others.slice(0, 3), ADDR.nominator].join('/')}`
    );
    await user.click(screen.getByRole('button', { name: 'Compare now' }));
    expect(await screen.findByTestId('navigated-away', {}, T)).toBeInTheDocument();
  });

  it('takes it out again', async () => {
    addPick(ADDR.nominator);
    const { user } = await open(explorerAccountPath(ADDR.nominator));
    await screen.findByRole('heading', { level: 1, name: 'Nora Nominator' }, T);
    await user.click(screen.getByRole('button', { name: 'Remove Nora Nominator from compare' }));
    expect(await screen.findByText('Removed from compare', {}, T)).toBeVisible();
    expect(store.get(comparePicksAtom)).toEqual([]);
  });
});
