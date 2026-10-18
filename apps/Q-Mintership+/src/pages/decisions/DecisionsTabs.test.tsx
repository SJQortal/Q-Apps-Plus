/**
 * Decisions with the nominations in it (Simon, 2026-10-17): the tab each
 * account opens on, the counts, the address, Propose with Propose
 * nomination first, the phone's floating button and swipes between tabs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigationType } from 'react-router-dom';
import { PROPOSE_NOMINATION } from '../../constants/words';
import { renderPage } from '../../test/render';
import DecisionsPage from './DecisionsPage';

vi.setConfig({ testTimeout: 30_000 });
const T = { timeout: 4000 };
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

/** Where the page is now, and how it got there. */
function Probe() {
  const location = useLocation();
  const type = useNavigationType();
  return (
    <output data-testid="at">
      {location.pathname}
      {location.search}|{type}
    </output>
  );
}
const at = () => screen.getByTestId('at').textContent ?? '';

const open = (persona: string, path = '/decisions') =>
  renderPage(
    <>
      <DecisionsPage />
      <Probe />
    </>,
    { persona, path, route: '/decisions' }
  );

const tab = (name: RegExp) => screen.getByRole('tab', { name });

/** matchMedia for a frame of `width` × `height`, optionally with a coarse pointer (touch). */
function frame(width: number, height: number, touch = false) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-(width|height):\s*([\d.]+)px\)/g)];
    const matches =
      (touch && query === '(pointer: coarse)') ||
      (sizes.length > 0 &&
        sizes.every(([, edge, side, value]) => {
          const size = side === 'width' ? width : height;
          return edge === 'min' ? size >= Number(value) : size <= Number(value);
        }));
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
}

describe('Decisions: its tabs', () => {
  it('opens a Minter Admin on Decisions, and everyone else on Nominations', async () => {
    const admin = await open('admin');
    expect(await screen.findByRole('region', { name: /^Collecting approvals/ }, T)).toBeVisible();
    expect(tab(/^All Decisions/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/^All Decisions/);
    admin.unmount();

    for (const persona of ['nominator', 'learner', 'signedOut']) {
      const { unmount } = await open(persona);
      expect(await screen.findByRole('list', { name: 'Open nominations' }, T)).toBeVisible();
      expect(tab(/^Nominations/)).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('region', { name: /^Collecting approvals/ })).toBeNull();
      unmount();
    }
  });

  it('says how many each tab lists, and keeps the tab in the address, in place', async () => {
    const u = userEvent.setup();
    await open('nominator');
    await screen.findByRole('list', { name: 'Open nominations' }, T);
    // Six open nominations; the decisions collecting approvals and the one waiting for a first.
    await waitFor(() => expect(tab(/^Nominations/)).toHaveAccessibleName('Nominations 6'), T);
    await waitFor(
      () => expect(tab(/^All Decisions/)).toHaveAccessibleName(/^All Decisions \d+$/),
      T
    );
    // Who asked to join is Propose → Decline a join request now: no tab of its own.
    expect(screen.queryByRole('tab', { name: /^Ready to mint/ })).toBeNull();

    await u.click(tab(/^All Decisions/));
    await waitFor(() => expect(at()).toBe('/decisions?show=decisions|REPLACE'), T);
    expect(await screen.findByRole('region', { name: /^Collecting approvals/ }, T)).toBeVisible();
    // Read-only for them, said once, without the note about nominating.
    expect(screen.getByText(/Only Minter Admins approve or reject decisions/)).toBeVisible();
    expect(screen.queryByText(/Members can nominate from level 5/)).toBeNull();
  });

  it('has no Nominations tab while none are open, unless it is on screen', async () => {
    // Simon, 2026-10-18: "If there is 0 nominations do not show this tab".
    const empty = {
      setup: (world: { records: unknown[]; pending: unknown[] }) => {
        world.records.length = 0;
        world.pending.length = 0;
      },
    };
    const learner = await renderPage(
      <>
        <DecisionsPage />
        <Probe />
      </>,
      { persona: 'learner', path: '/decisions', route: '/decisions', ...empty }
    );
    // Nothing to list there, so they open on All Decisions.
    await waitFor(() => expect(tab(/^All Decisions/)).toHaveAttribute('aria-selected', 'true'), T);
    expect(screen.queryByRole('tab', { name: /^Nominations/ })).toBeNull();
    learner.unmount();
    // A link to it still opens it, with its tab, saying none are open.
    await renderPage(<DecisionsPage />, {
      persona: 'learner',
      path: '/decisions?show=nominations',
      route: '/decisions',
      ...empty,
    });
    expect(await screen.findByText('No open nominations right now', {}, T)).toBeVisible();
    expect(tab(/^Nominations/)).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the nominee’s own nomination on top, whatever the tab', async () => {
    await open('nominatedWaiting', '/decisions?show=decisions');
    const mine = await screen.findByRole('region', { name: 'Your nomination' }, T);
    expect(within(mine).getByRole('button', { name: 'Accept nomination' })).toBeVisible();
    expect(tab(/^All Decisions/)).toHaveAttribute('aria-selected', 'true');
    // Above the tabs.
    expect(
      mine.compareDocumentPosition(screen.getByRole('tablist')) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('Decisions: Propose', () => {
  it('starts with Propose nomination for a Minter Admin', async () => {
    const u = userEvent.setup();
    await open('admin');
    await screen.findByRole('region', { name: /^Collecting approvals/ }, T);
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    const items = await screen.findAllByRole('menuitem');
    expect(items[0]).toHaveAccessibleName(/^Propose nomination/);
    expect(items[1]).toHaveAccessibleName(/^Remove a member/);
    // No second button with the words in the header.
    expect(screen.queryByRole('button', { name: PROPOSE_NOMINATION })).toBeNull();
    await u.click(items[0]);
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('is Propose nomination alone for a level 5+ member, on every tab', async () => {
    const u = userEvent.setup();
    await open('nominator', '/decisions?show=decisions');
    await screen.findByRole('region', { name: /^Collecting approvals/ }, T);
    expect(screen.queryByRole('button', { name: 'Propose' })).toBeNull();
    await u.click(screen.getByRole('button', { name: PROPOSE_NOMINATION }));
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('cleans up stale invites from another tab: Decisions opens there, at the section', async () => {
    const u = userEvent.setup();
    await open('admin', '/decisions?show=nominations');
    await screen.findByRole('list', { name: 'Open nominations' }, T);
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /^Clean up stale invites/ }));
    await waitFor(() => expect(at()).toBe('/decisions?show=decisions|REPLACE'), T);
    const section = await screen.findByRole('region', { name: /^Clean up stale invites/ }, T);
    await waitFor(() => expect(section).toHaveFocus(), T);
  });

  it('is the floating button on a phone, with Propose nomination first in its sheet', async () => {
    frame(360, 780);
    const u = userEvent.setup();
    await open('admin');
    await screen.findByRole('region', { name: /^Collecting approvals/ }, T);
    const fab = screen.getByRole('button', { name: 'Propose' });
    expect(fab).toHaveClass('MuiFab-circular');
    expect(fab).toHaveTextContent(/^$/);
    await u.click(fab);
    const sheet = await screen.findByRole('dialog', { name: 'Propose' });
    const choices = within(sheet)
      .getAllByRole('button')
      .filter((b) => b.textContent);
    expect(choices[0]).toHaveTextContent(/^Propose nomination/);
  });
});

describe('Decisions: swipes between tabs', () => {
  it('opens the next tab with a swipe to the left and the previous one to the right, in place', async () => {
    frame(390, 844, true);
    await open('nominator');
    const panel = await screen.findByRole('tabpanel', { name: /^Nominations/ }, T);
    const swipe = (dx: number) => {
      for (const [type, x] of [
        ['touchstart', 200],
        ['touchmove', 200 + dx / 2],
        ['touchend', 200 + dx],
      ] as const) {
        const event = new Event(type, { bubbles: true });
        const points = [{ clientX: x, clientY: 300 }];
        Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : points });
        Object.defineProperty(event, 'changedTouches', { value: points });
        screen.getByRole('tabpanel').dispatchEvent(event);
      }
    };
    expect(panel).toBeInTheDocument();
    swipe(150);
    await waitFor(() => expect(at()).toBe('/decisions?show=decisions|REPLACE'), T);
    expect(tab(/^All Decisions/)).toHaveAttribute('aria-selected', 'true');
    // Nothing before All Decisions.
    swipe(150);
    swipe(-150);
    await waitFor(() => expect(at()).toBe('/decisions?show=nominations|REPLACE'), T);
    // Nothing after Nominations among the views: a swipe stays.
    swipe(-150);
    await new Promise((r) => setTimeout(r, 300));
    expect(at()).toBe('/decisions?show=nominations|REPLACE');
  });

  it('adds a tab for each kind of decision with something open, narrowing All Decisions to it', async () => {
    const u = userEvent.setup();
    await open('admin');
    await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
    const names = screen.getAllByRole('tab').map((t) => t.textContent);
    // All Decisions and Nominations, then the kinds that have something open.
    expect(names.slice(0, 2).map((n) => n?.replace(/\s*\d+$/, ''))).toEqual([
      'All Decisions',
      'Nominations',
    ]);
    expect(names.some((n) => /^Ready to mint/.test(n ?? ''))).toBe(false);
    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^New MAs \d+$/),
        expect.stringMatching(/^Lift ban 1$/),
      ])
    );
    // None for a kind with nothing open.
    expect(names.some((n) => /^Declines/.test(n ?? ''))).toBe(false);
    expect(names).toEqual(expect.arrayContaining([expect.stringMatching(/^Clean invites \d+$/)]));
    await u.click(tab(/^Lift ban/));
    expect(at()).toBe('/decisions?show=liftBans|REPLACE');
    expect(tab(/^Lift ban/)).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAccessibleName(/^Lift ban/);
    await waitFor(
      () =>
        expect(
          within(panel).getAllByRole('heading', { name: /^Lift a ban/ }).length
        ).toBeGreaterThan(0),
      T
    );
    // Only that kind: no other section, no nominations waiting, no polls or stale invites.
    expect(within(panel).queryByRole('heading', { name: /^Minter Admin changes/ })).toBeNull();
    expect(
      within(panel).queryByRole('heading', { name: /^Waiting for a Minter Admin/ })
    ).toBeNull();
    expect(within(panel).queryByRole('heading', { name: /^Clean up stale invites/ })).toBeNull();
    for (const card of within(panel).queryAllByRole('article'))
      expect(card).toHaveAccessibleName(/ban/i);
    // All Decisions again: everything.
    await u.click(tab(/^All Decisions/));
    await waitFor(
      () =>
        expect(
          within(screen.getByRole('tabpanel')).getByRole('heading', {
            name: /^Minter Admin changes/,
          })
        ).toBeInTheDocument(),
      T
    );
  });

  it('a kind’s link opens on its tab, and says so when nothing of it is open', async () => {
    await open('admin', '/decisions?show=declines');
    const declines = await screen.findByRole('tab', { name: /^Declines/ }, T);
    expect(declines).toHaveAttribute('aria-selected', 'true');
    expect(
      await screen.findByText('No declines collecting approvals now', {}, T)
    ).toBeInTheDocument();
  });
});
