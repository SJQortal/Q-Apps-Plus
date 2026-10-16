/**
 * Compare in the mock world, strict (any read the world can't answer
 * fails): Kit Kicked and Lou Left (payments both ways, a trade, the same
 * first payer, shared groups), four accounts with the pair grid, what the
 * link leaves out, Remove and Add, the picks following the page, Side by
 * side as a table or stacked, and Copy findings. Read-only: no POST, no
 * write request.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { getDefaultStore } from 'jotai';
import { renderPage } from '../../test/render';
import { expectNoAxeViolations } from '../../test/axe';
import { fetchCallsFor, qortalCalls } from '../../test/setup';
import { ADDR } from '../../test/world';
import {
  AT_ADDRESS,
  MESSAGE_CONTENT,
  SPONSEES,
  SPONSOR,
  UNUSED_ADDRESS,
} from '../../../e2e/world.mjs';
import { explorerAccountPath, explorerComparePath } from '../../routes/paths';
import { comparePicksAtom, resetExplorerState } from '../../state/explorer';
import ComparePage from './ComparePage';
import { UNUSED_ADDRESS as UNUSED_WORDS } from './explorerWords';

const T = { timeout: 8000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const VERDICTS =
  /\b(alts?|suspicious|same person|fraud|strong(est)?|weak|consolidation|linked accounts|likel(y|ihood)|score)\b/i;
const store = getDefaultStore();
// Role queries skip their visibility check: on a page this size each one
// otherwise takes most of a second (toBeVisible still checks where it matters).
configure({ defaultHidden: true });
const SAM = SPONSEES[0].address;

function Probe() {
  const location = useLocation();
  return <output data-testid="at">{location.pathname}</output>;
}

async function open(path: string) {
  const result = await renderPage(
    <>
      <Routes>
        <Route path="explorer/compare/*" element={<ComparePage />} />
        <Route path="*" element={<div data-testid="elsewhere" />} />
      </Routes>
      <Probe />
    </>,
    { persona: 'learner', path, route: '/*', strict: true }
  );
  return { ...result, user: userEvent.setup() };
}

const at = () => screen.getByTestId('at').textContent ?? '';
/** What an element says, without its decorative parts (the avatars' letters). */
function spoken(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return (copy.textContent ?? '').replace(/\s+/g, ' ');
}
const region = (name: string) => screen.findByRole('region', { name }, T);

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

const originalMatchMedia = window.matchMedia;
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

beforeEach(() => resetExplorerState());
afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
});

describe('Compare: two accounts', () => {
  it(
    'Kit Kicked and Lou Left: who they are, what was recorded, the timeline, what they share',
    { timeout: 30_000 },
    async () => {
      const { container, posts } = await open(explorerComparePath([ADDR.kicked, ADDR.left]));
      expect(screen.getByRole('heading', { level: 1, name: 'Compare accounts' })).toBeVisible();
      expect(
        screen.getByText(/Nothing here shows who runs an account\./, { selector: '[role="note"]' })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /link to this comparison/i })).toBeVisible();

      // Each account lettered, with its level and where it stands in MINTER.
      const cards = screen.getByRole('list', { name: 'Accounts compared' });
      await waitFor(() => expect(cards).toHaveTextContent(/A.*Kit Kicked.*B.*Lou Left/), T);
      const kit = await screen.findByRole('list', { name: 'About Kit Kicked' }, T);
      expect(kit).toHaveTextContent('Level 3');
      await waitFor(() => expect(kit).toHaveTextContent('Former member'), T);
      expect(
        screen.getByRole('button', { name: 'Remove Lou Left (B) from this comparison' })
      ).toBeVisible();
      // The picks follow the page.
      expect(store.get(comparePicksAtom)).toEqual([ADDR.kicked, ADDR.left]);
      // No pair grid for two.
      expect(screen.queryByRole('navigation', { name: 'Pairs' })).toBeNull();

      // Recorded between them: payments each way, exact sums, and the trade.
      const recorded = await region('Recorded between them');
      const list = await within(recorded).findByRole('list', { name: 'Recorded between A–B' }, T);
      await waitFor(
        () => expect(spoken(list)).toContain('Kit Kicked paid Lou Left 120 QORT in 4 payments'),
        T
      );
      expect(spoken(list)).toContain('Lou Left paid Kit Kicked 6.3 QORT in 2 payments');
      await waitFor(
        () =>
          expect(spoken(list)).toContain(
            'Lou Left sold 12 QORT to Kit Kicked on the trade portal in 1 trade'
          ),
        T
      );
      await waitFor(
        () =>
          expect(recorded).toHaveTextContent(
            'Checked, none found: reward shares, level moves, name sales, Q-Mintership records.'
          ),
        T
      );

      // Timeline together: firsts in order, with the gap between them.
      const timeline = await region('Timeline together');
      await waitFor(
        () =>
          expect(spoken(timeline)).toMatch(
            /first QORT payment from Hal Helper.*Block 1,364,165.*5 blocks later.*first QORT payment from Hal Helper.*Block 1,364,170/
          ),
        T
      );
      expect(timeline).toHaveTextContent(
        /created a self-share.*Block 1,371,000.*14 blocks later.*created a self-share.*Block 1,371,014/
      );

      // In common: the same first payer (with how busy it is), groups smallest first, timing.
      const common = await region('In common');
      await waitFor(
        () =>
          expect(spoken(common)).toContain(
            'Both got their first QORT payment from Hal Helper (blocks 1,364,165 and 1,364,170). Hal Helper has sent 500+ payments.'
          ),
        T
      );
      expect(common).toHaveTextContent('Hal Helper paid both');
      expect(common).toHaveTextContent('A received 1 payment · B received 1 payment');
      const groups = within(common).getByRole('list', { name: 'Shared groups' });
      expect(
        within(groups)
          .getAllByRole('listitem')
          .map((li) => li.textContent)
      ).toEqual(['Book Club (12 members)', 'Qortal General (5,200 members)', 'Some other group']);
      expect(common).toHaveTextContent('First seen 5 blocks apart');
      expect(common).toHaveTextContent('Self-shares created 14 blocks apart');
      await waitFor(
        () => expect(common).toHaveTextContent('Checked, none found: a shared sponsor.'),
        T
      );

      // Side by side, stacked (not a wide screen): equal values once.
      const side = await region('Side by side');
      expect(within(side).queryByRole('table')).toBeNull();
      await waitFor(
        () => expect(side).toHaveTextContent('MINTER statusSame for all: Former member'),
        T
      );
      await waitFor(() => expect(side).toHaveTextContent('BalanceSame for all: 12.5 QORT'), T);
      expect(side).toHaveTextContent(/LevelALevel 3BLevel 5/);

      // The message between them never shows; an AT is not a person to list.
      expect(document.body.textContent).not.toContain(MESSAGE_CONTENT);
      expect(document.body.textContent).not.toMatch(VERDICTS);
      expect(fetchCallsFor('buyerPublicKey')).toEqual([]);
      expect(fetchCallsFor('/chat/')).toEqual([]);
      await expectNoAxeViolations(container);
      noWrites(posts);
    }
  );

  it('opens what stands behind a finding: payments link to their transactions, a trade to its AT', async () => {
    const { user, world } = await open(explorerComparePath([ADDR.kicked, ADDR.left]));
    const recorded = await region('Recorded between them');
    const toggle = await within(recorded).findByRole(
      'button',
      { name: 'Show the 4 payments from Kit Kicked to Lou Left' },
      T
    );
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(
      toggle.getAttribute('aria-controls') ?? ''
    ) as HTMLElement;
    const links = await within(panel).findAllByRole('link', { name: /^Open transaction/ }, T);
    expect(links).toHaveLength(4);
    const kitLou = (world.explorer as { sigs: { kitLou: string[] } }).sigs.kitLou;
    expect(links[0]).toHaveAttribute('href', `/explorer/tx/${kitLou[5]}`);
    const trade = await within(recorded).findByRole(
      'button',
      { name: 'Show the 1 trade from Lou Left to Kit Kicked' },
      T
    );
    await user.click(trade);
    const tradePanel = document.getElementById(
      trade.getAttribute('aria-controls') ?? ''
    ) as HTMLElement;
    expect(
      await within(tradePanel).findByRole('link', { name: /explore this automated contract/ }, T)
    ).toHaveAttribute('href', `/explorer/account/${AT_ADDRESS}`);
    expect(document.body.textContent).not.toContain(MESSAGE_CONTENT);
  });

  it('Side by side is a table from 900 px, the accounts as its columns', async () => {
    screenWidth(1280);
    const { container } = await open(explorerComparePath([ADDR.kicked, ADDR.left]));
    const side = await region('Side by side');
    const table = within(side).getByRole('table');
    await waitFor(
      () =>
        expect(
          within(table)
            .getAllByRole('columnheader')
            .map((h) => h.textContent)
        ).toEqual(['Fact', 'AKit Kicked', 'BLou Left']),
      T
    );
    expect(within(table).getByRole('rowheader', { name: 'Blocks minted' })).toBeInTheDocument();
    await waitFor(
      () =>
        expect(within(table).getByRole('row', { name: /^MINTER status/ })).toHaveTextContent(
          'Same for all: Former member'
        ),
      T
    );
    expect(table).toHaveTextContent('640,000');
    await expectNoAxeViolations(container);
  });

  it('copies the findings: the accounts, the block, what was read, each finding, the link', async () => {
    const { user } = await open(explorerComparePath([ADDR.kicked, ADDR.left]));
    // After userEvent.setup(), which puts its own clipboard in place.
    const writeText = vi.fn(async (text: string) => void text);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const common = await region('In common');
    await waitFor(() => expect(common).toHaveTextContent('Self-shares created 14 blocks apart'), T);
    const recorded = await region('Recorded between them');
    await waitFor(() => expect(recorded).toHaveTextContent('on the trade portal'), T);
    await user.click(screen.getByRole('button', { name: 'Copy findings' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled(), T);
    const text = writeText.mock.calls[0][0] as string;
    expect(text.split('\n')[0]).toBe('Compare accounts, checked at block 2,757,500');
    expect(text).toContain(`A: Kit Kicked (${ADDR.kicked})`);
    expect(text).toContain(`B: Lou Left (${ADDR.left})`);
    expect(text).toContain('Payments between each pair: every QORT payment each way');
    expect(text).toMatch(
      /- Kit Kicked \(Q\w{5}…\w{4}\) paid Lou Left \(Q\w{5}…\w{4}\) 120 QORT in 4 payments \(\w{3} 2023 – \w{3} 2025\) \(blocks 1,364,500–2,100,000, 4 transactions, newest \w{8}…\)/
    );
    expect(text).toMatch(/sold 12 QORT to .* on the trade portal in 1 trade \(\d+ \w+ \d{4}\)\n/);
    expect(text).toContain('Checked, none found: reward shares, level moves');
    expect(text).toContain('First seen 5 blocks apart');
    expect(text).toMatch(/- Block 1,364,165 · A: first QORT payment from Hal Helper/);
    expect(text).toMatch(/- 5 blocks later · Block 1,364,170 · B: first QORT payment/);
    expect(text).toContain('Side by side:');
    expect(text).toContain('- MINTER status: same for all, Former member');
    expect(text).toContain(
      `qortal://APP/Q-Mintership+/explorer/compare/${ADDR.kicked}/${ADDR.left}`
    );
    expect(text).not.toMatch(VERDICTS);
    expect(text).not.toContain(MESSAGE_CONTENT);
    expect(
      await screen.findByText('Findings copied', { selector: '[role="status"]' })
    ).toBeInTheDocument();
  });
});

describe('Compare: four accounts', () => {
  it(
    'a grid of every pair, each one jumping to what was recorded',
    { timeout: 30_000 },
    async () => {
      const { container, user, posts } = await open(
        explorerComparePath([ADDR.kicked, ADDR.left, SPONSOR.address, SAM])
      );
      const grid = await screen.findByRole('navigation', { name: 'Pairs' }, T);
      await waitFor(() => expect(grid).toHaveTextContent('A–B: 3 recorded, 5 in common'), T);
      await waitFor(() => expect(grid).toHaveTextContent('C–D: 2 recorded, 1 in common'), T);
      expect(within(grid).getAllByRole('listitem')).toHaveLength(6);
      expect(grid).toHaveTextContent('A–C: 2 in common');

      // C–D: Sid paid Sam and made a reward share to it.
      const recorded = await region('Recorded between them');
      const cd = await within(recorded).findByRole('list', { name: 'Recorded between C–D' }, T);
      await waitFor(
        () => expect(spoken(cd)).toContain('Sid Sponsor paid Sam Sprout 0.5 QORT in 1 payment'),
        T
      );
      await waitFor(
        () =>
          expect(spoken(cd)).toContain(
            'Sid Sponsor made a reward share to Sam Sprout at 0 %, removed after 120,000 blocks'
          ),
        T
      );
      // Pairs with nothing: one line, and no block of their own.
      await waitFor(
        () =>
          expect(recorded).toHaveTextContent(
            'A–C, A–D, B–C, B–D: checked, none found: payments both ways, reward shares, level moves, name sales, Q-Mintership records, trade portal sales.'
          ),
        T
      );
      expect(within(recorded).queryByRole('list', { name: 'Recorded between A–C' })).toBeNull();

      // The grid jumps to the pair's block and puts focus there.
      await user.click(within(grid).getByRole('button', { name: /C–D/ }));
      expect(document.activeElement).toBe(cd.parentElement);

      // Groups say who, when not all of them share one; timing in order.
      const common = await region('In common');
      await waitFor(() => expect(common).toHaveTextContent('Book Club (12 members) · A and B'), T);
      await waitFor(
        () =>
          expect(common).toHaveTextContent(
            'First seen 19,000 blocks apart, first to last: C, A, B, D'
          ),
        T
      );
      // Four is the most: the field gives way to the limit.
      expect(screen.queryByRole('combobox', { name: 'Add an account' })).toBeNull();
      expect(screen.getByText('Compare holds 4 accounts. Remove one first.')).toBeVisible();
      expect(document.body.textContent).not.toMatch(VERDICTS);
      await expectNoAxeViolations(container);
      noWrites(posts);
    }
  );
});

describe('Compare: the link', () => {
  it('leaves out what isn’t a valid address, an AT and a repeat, and says so', async () => {
    await open(
      `/explorer/compare/${ADDR.kicked}/nonsense/${ADDR.kicked}/${AT_ADDRESS}/${ADDR.left}`
    );
    expect(
      screen.getByText(
        /^Left out of this comparison: “nonsense” isn't a valid Qortal address; Q\w{5}…\w{4} was in the link twice; A\w{5}…\w{4} is an AT address \(an automated contract\), not a personal account\.$/
      )
    ).toBeInTheDocument();
    const cards = screen.getByRole('list', { name: 'Accounts compared' });
    expect(within(cards).getAllByRole('button', { name: /^Remove / })).toHaveLength(2);
    expect(store.get(comparePicksAtom)).toEqual([ADDR.kicked, ADDR.left]);
  });

  it('one account asks for another; none says so', async () => {
    await open(explorerComparePath([ADDR.kicked]));
    expect(screen.getByText('Add another account to compare it with.')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Recorded between them' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Add an account' })).toBeVisible();
  });

  it('an address Core has never seen says so on its card, and nothing more is read about it', async () => {
    await open(explorerComparePath([ADDR.kicked, UNUSED_ADDRESS, ADDR.left]));
    expect(await screen.findByText(UNUSED_WORDS, {}, T)).toBeInTheDocument();
    const recorded = await region('Recorded between them');
    await waitFor(() => expect(spoken(recorded)).toContain('Kit Kicked paid Lou Left'), T);
    expect(screen.queryByRole('navigation', { name: 'Pairs' })).toBeNull();
    expect(fetchCallsFor(`/names/primary/${UNUSED_ADDRESS}`)).toEqual([]);
    expect(fetchCallsFor(`senderAddress=${UNUSED_ADDRESS}`)).toEqual([]);
  });
});

describe('Compare: Remove and Add', () => {
  it('Remove opens the link without it; under two, the account that is left', async () => {
    const { user } = await open(explorerComparePath([ADDR.kicked, ADDR.left, SPONSOR.address]));
    await user.click(await screen.findByRole('button', { name: /^Remove Sid Sponsor \(C\)/ }, T));
    expect(at()).toBe(explorerComparePath([ADDR.kicked, ADDR.left]));
    await user.click(await screen.findByRole('button', { name: /^Remove Lou Left \(B\)/ }, T));
    expect(at()).toBe(explorerAccountPath(ADDR.kicked));
  });

  it('Add opens the link with it, and a repeat is said instead', async () => {
    const { user } = await open(explorerComparePath([ADDR.kicked, ADDR.left]));
    await user.type(
      screen.getByRole('combobox', { name: 'Add an account' }),
      `${ADDR.kicked}{Enter}`
    );
    expect(await screen.findByText('Already in this comparison, as A.', {}, T)).toBeVisible();
    expect(at()).toBe(explorerComparePath([ADDR.kicked, ADDR.left]));
    await user.type(
      screen.getByRole('combobox', { name: 'Add an account' }),
      `${SPONSOR.address}{Enter}`
    );
    await waitFor(
      () => expect(at()).toBe(explorerComparePath([ADDR.kicked, ADDR.left, SPONSOR.address])),
      T
    );
    expect(store.get(comparePicksAtom)).toEqual([ADDR.kicked, ADDR.left, SPONSOR.address]);
  });
});
