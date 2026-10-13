import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeAddress } from '../../../e2e/world.mjs';
import { PROPOSE_NOMINATION } from '../../constants/words';
import { renderPage } from '../../test/render';
import { mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import NominationsPage from './NominationsPage';
import { renderWithWorld } from './testRender';

afterEach(() => vi.useRealTimers());

const open = (persona: string, path = '/nominations') =>
  renderPage(<NominationsPage />, { persona, path, route: '/nominations' });

const card = (name: RegExp | string) =>
  screen.findByRole(
    'article',
    { name: new RegExp(`Nomination of ${String(name)}`) },
    { timeout: 4000 }
  );

function cardNames(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('article')
    .map((a) => a.getAttribute('aria-label')?.replace('Nomination of ', '') ?? '');
}

function decode(data64: unknown): unknown {
  const bytes = Uint8Array.from(atob(String(data64)), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe('Nominations page', () => {
  it('lists open nominations newest first, and offers Propose nomination to a level 5+ member', async () => {
    await open('nominator');
    await card('Wren Waiting');
    const list = screen.getByRole('list', { name: 'Open nominations' });
    const names = cardNames(list);
    expect(names.indexOf('Wren Waiting')).toBeLessThan(names.indexOf('bob+builder'));
    expect(names.indexOf('bob+builder')).toBeLessThan(names.indexOf('Uma Urgent'));
    // Decided ones are not in the open list.
    expect(names).not.toContain('Ünïcode Ñame');
    expect(screen.getByRole('button', { name: PROPOSE_NOMINATION })).toBeInTheDocument();
    // Nora nominated these herself.
    expect(within(await card('Wren Waiting')).getByText('You nominated them')).toBeInTheDocument();
    // A nominee whose join request is in reads as ready, in the same words everywhere.
    expect(within(await card('bob\\+builder')).getByText('Ready to mint')).toBeInTheDocument();
    expect(within(await card('Wren Waiting')).queryByText('Ready to mint')).toBeNull();
    expect(within(list).queryByText(/accepted/i)).toBeNull();
  });

  it('filters by state and shows the count on each filter', async () => {
    const user = userEvent.setup();
    await open('nominator');
    await card('Wren Waiting');
    const list = () => screen.getByRole('list', { name: 'Open nominations' });

    await user.click(screen.getByRole('button', { name: /Waiting for a Minter Admin\s*1/ }));
    expect(cardNames(list())).toEqual(['Wren Waiting']);

    await user.click(screen.getByRole('button', { name: /Collecting signatures\s*5/ }));
    expect(cardNames(list())).toHaveLength(5);
    expect(cardNames(list())).toContain('bob+builder');
    expect(cardNames(list())).not.toContain('Wren Waiting');

    await user.click(screen.getByRole('button', { name: /^Approved\s*0/ }));
    expect(screen.getByText('No nominations match')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(cardNames(list())).toHaveLength(6);
  });

  it('searches by name, by address, and by who nominated', async () => {
    const user = userEvent.setup();
    await open('nominator');
    await card('Wren Waiting');
    const search = screen.getByRole('searchbox', { name: /Search nominations/ });
    const list = () => screen.getByRole('list', { name: 'Open nominations' });

    await user.type(search, 'BOB+');
    expect(cardNames(list())).toEqual(['bob+builder']);

    await user.clear(search);
    await user.type(search, ADDR.urgent.slice(0, 12));
    expect(cardNames(list())).toEqual(['Uma Urgent']);

    await user.clear(search);
    await user.type(search, 'nora');
    expect(cardNames(list())).toEqual(['Wren Waiting', 'bob+builder', 'Uma Urgent']);

    await user.clear(search);
    await user.type(search, 'nobody at all');
    expect(screen.getByText('No nominations match')).toBeInTheDocument();
    expect(screen.getByText(/Nothing here matches “nobody at all”/)).toBeInTheDocument();
  });

  it('tells a level 2 member why they can’t nominate yet, with the blocks to go', async () => {
    await open('learner');
    await card('Wren Waiting');
    expect(
      await screen.findByText(/Members can nominate from level 5\. You're level 2\./)
    ).toBeInTheDocument();
    expect(screen.getByText(/527,900 more blocks minted to reach level 5/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: PROPOSE_NOMINATION })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add your support/ })).toBeNull();
  });

  it('asks a signed-out visitor to sign in', async () => {
    await open('signedOut');
    await card('Wren Waiting');
    expect(screen.getByText(/Sign in to propose a nomination/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets a Minter Admin add their support with a note, through Hub', async () => {
    const user = userEvent.setup();
    const { address } = await open('admin');
    const wren = await card('Wren Waiting');
    // Admins can jump to the Decisions queue from an open nomination.
    expect(
      within(wren).getByRole('link', { name: 'Open in Decisions: Wren Waiting' })
    ).toBeInTheDocument();
    // Enough signatures already (8 of 8), or too late to count: support would change nothing.
    // Chain-only nominations show the nominee's name, looked up.
    for (const done of ['Mia Met', 'Lars Late']) {
      const c = await card(done);
      expect(within(c).queryByRole('button', { name: /^Add your support/ })).toBeNull();
    }
    expect(
      within(await card('Eli Early')).getByRole('button', {
        name: 'Add your support for Eli Early',
      })
    ).toBeInTheDocument();
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({
      type: 'ARBITRARY',
      signature: 'SupportSig',
      timestamp: Date.now(),
    }));

    await user.click(
      within(wren).getByRole('button', { name: 'Add your support for Wren Waiting' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Add your support' });
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/A note/), 'Helps everyone in the minting chat.');
    expect(within(dialog).getByText('35 / 280')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText('Support published', {}, { timeout: 4000 })
    ).toBeInTheDocument();

    const [call] = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(call).toMatchObject({
      name: 'Avery Admin',
      service: 'JSON',
      identifier: `qmp-support-${ADDR.nominatedWaiting}`,
    });
    expect(decode(call.data64)).toEqual({
      v: 1,
      nomineeAddress: ADDR.nominatedWaiting,
      note: 'Helps everyone in the minting chat.',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(await within(wren).findByText(/Support sent ✓ \(confirming…\)/)).toBeInTheDocument();
    expect(address).toBe(ADDR.admin);
  });

  it('shows who already supports a nomination instead of the button', async () => {
    await open('adminL4');
    const wren = await card('Wren Waiting');
    expect(within(wren).getByText('You support this')).toBeInTheDocument();
    expect(within(wren).queryByRole('button', { name: /^Add your support/ })).toBeNull();
  });

  it('puts the nominee’s own nomination first, with Accept nomination (JOIN_GROUP)', async () => {
    const user = userEvent.setup();
    await open('nominatedWaiting');
    const mine = await screen.findByRole('region', { name: 'Your nomination' }, { timeout: 4000 });
    expect(within(mine).getByRole('article', { name: /Wren Waiting/ })).toBeInTheDocument();
    // Not repeated in the open list.
    expect(cardNames(screen.getByRole('list', { name: 'Open nominations' }))).not.toContain(
      'Wren Waiting'
    );
    mockQortalRequest('JOIN_GROUP', () => ({
      type: 'JOIN_GROUP',
      signature: 'JoinSig',
      timestamp: Date.now(),
    }));

    await user.click(within(mine).getByRole('button', { name: 'Accept nomination' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accept your nomination' });
    // Home and Nominations share this dialog: the signatures needed, then the fee.
    expect(within(dialog).getByText(/once 8 Minter Admins have signed/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText("You're ready ✓", {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toEqual([{ action: 'JOIN_GROUP', groupId: 694 }]);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(await within(mine).findByText("You're ready ✓ (confirming…)")).toBeInTheDocument();
  });

  it('says how to get the fee when the nominee has no QORT, and sends nothing', async () => {
    const user = userEvent.setup();
    const { world } = await open('nominatedWaiting');
    world.accounts.get(ADDR.nominatedWaiting).balance = 0;
    const mine = await screen.findByRole('region', { name: 'Your nomination' }, { timeout: 4000 });
    await user.click(within(mine).getByRole('button', { name: 'Accept nomination' }));
    const dialog = await screen.findByRole('dialog', { name: 'Accept your nomination' });
    expect(
      await within(dialog).findByText(/You need 0.01 QORT for the fee first/)
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Your confirmed balance is 0 QORT/)).toHaveTextContent(
      /Ask Nora Nominator to send/
    );
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText(/This needs 0.01 QORT for the fee/, {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(0);
  });

  it('shows a nominee whose join request is in that approval will make them a member', async () => {
    await open('nominatedSigning');
    const mine = await screen.findByRole('region', { name: 'Your nomination' }, { timeout: 4000 });
    expect(
      within(mine).getByText("You're ready ✓: when the admins approve, you're in at once.")
    ).toBeInTheDocument();
    expect(within(mine).queryByRole('button', { name: 'Accept nomination' })).toBeNull();
  });

  it('offers Join now to an approved person, even without a nomination card', async () => {
    const user = userEvent.setup();
    await open('approved');
    const mine = await screen.findByRole('region', { name: 'Your nomination' }, { timeout: 4000 });
    expect(within(mine).getByText('You were approved for MINTER')).toBeInTheDocument();
    mockQortalRequest('JOIN_GROUP', () => ({ type: 'JOIN_GROUP', signature: 'J2' }));
    await user.click(within(mine).getByRole('button', { name: 'Join now' }));
    const dialog = await screen.findByRole('dialog', { name: 'Join MINTER' });
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText('Welcome to MINTER ✓', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(1);
  });

  it('keeps recently decided ones collapsed, with Propose nomination again for expired and lapsed', async () => {
    const user = userEvent.setup();
    await open('nominator');
    await card('Wren Waiting');
    const toggle = screen.getByRole('button', { name: /Show 2/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Recently decided nominations' })).toBeNull();
    await user.click(toggle);
    const decided = screen.getByRole('list', { name: 'Recently decided nominations' });
    expect(cardNames(decided)).toEqual([
      'Lapsed Person With A Very Long Name That Wraps On Phones',
      'Ünïcode Ñame',
    ]);
    expect(within(decided).getByText(/Expired 4 days ago/)).toBeInTheDocument();
    const again = within(decided).getAllByRole('button', { name: `${PROPOSE_NOMINATION} again` });
    expect(again).toHaveLength(2);
    await user.click(again[1]);
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('says so when nothing is open, and offers Propose nomination to those who can', async () => {
    const user = userEvent.setup();
    await renderWithWorld(<NominationsPage />, {
      persona: 'nominator',
      path: '/nominations',
      route: '/nominations',
      before: (world) => {
        world.records.length = 0;
        world.pending.length = 0;
      },
    });
    expect(
      await screen.findByText('No open nominations right now', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    const region = screen.getByRole('region', { name: 'Open nominations' });
    await user.click(within(region).getByRole('button', { name: PROPOSE_NOMINATION }));
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('shows an error with Retry when the nominations can’t be read', async () => {
    await renderWithWorld(<NominationsPage />, {
      persona: 'learner',
      path: '/nominations',
      route: '/nominations',
      before: () =>
        mockFetchRoute(
          '/arbitrary/resources/searchsimple',
          () => new Response('', { status: 500 })
        ),
    });
    expect(
      await screen.findByText('Couldn’t load the nominations.', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('notes when a read stopped before the end of a very long list', async () => {
    await renderWithWorld(<NominationsPage />, {
      persona: 'nominator',
      path: '/nominations',
      route: '/nominations',
      before: (world) => {
        for (let i = 0; i < 3_000; i++) world.members.push(fakeAddress(`many-${i}`));
      },
    });
    expect(
      await screen.findByText(/Showing the first part of the nominations/, {}, { timeout: 8000 })
    ).toBeInTheDocument();
  });

  it('keeps the filter in the address so Back returns to the same view', async () => {
    await open('nominator', '/nominations?show=waiting');
    await card('Wren Waiting');
    expect(cardNames(screen.getByRole('list', { name: 'Open nominations' }))).toEqual([
      'Wren Waiting',
    ]);
    expect(screen.getByRole('button', { name: /Waiting for a Minter Admin/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

describe('Nominations page: Propose nomination at every width', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  /** matchMedia for a frame of `width` × `height` (the min/max width and height queries). */
  function frame(width: number, height: number) {
    window.matchMedia = ((query: string) => {
      const sizes = [...query.matchAll(/\((min|max)-(width|height):\s*([\d.]+)px\)/g)];
      const matches =
        sizes.length > 0 &&
        sizes.every(([, edge, side, value]) => {
          const size = side === 'width' ? width : height;
          return edge === 'min' ? size >= Number(value) : size <= Number(value);
        });
      return { ...originalMatchMedia(query), matches };
    }) as typeof window.matchMedia;
  }

  it('is a round floating button on a phone, icon only, named for screen readers', async () => {
    frame(360, 780);
    await open('nominator');
    await card('Wren Waiting');
    const fab = await screen.findByRole('button', { name: PROPOSE_NOMINATION });
    // The only one: the header has no second button with the words.
    expect(screen.getAllByRole('button', { name: PROPOSE_NOMINATION })).toHaveLength(1);
    expect(fab).toHaveTextContent(/^$/);
    // MUI's large round Fab: 56 px across.
    expect(fab).toHaveClass('MuiFab-circular', 'MuiFab-sizeLarge');
    expect(fab).not.toHaveClass('MuiFab-extended');
    await userEvent.click(fab);
    expect(await screen.findByTestId('navigated-away')).toBeInTheDocument();
  });

  it('keeps its words in the header on wider screens and in a landscape frame', async () => {
    for (const [width, height] of [
      [1280, 800],
      [844, 390],
    ]) {
      frame(width, height);
      const { unmount } = await open('nominator');
      await card('Wren Waiting');
      const button = await screen.findByRole('button', { name: PROPOSE_NOMINATION });
      expect(button).toHaveTextContent(PROPOSE_NOMINATION);
      expect(button).not.toHaveClass('MuiFab-root');
      unmount();
    }
  });
});
