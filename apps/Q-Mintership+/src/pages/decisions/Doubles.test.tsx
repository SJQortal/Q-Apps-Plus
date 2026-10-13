/**
 * Doubles (rules/double.ts) on the screens: an admin's own second "Become a
 * Minter Admin", a removal of someone who isn't a Minter Admin, and the same
 * addition waiting twice (e2e/world.mjs addDoubles). Each says so on its
 * card and its own page, keeps Sign and Reject as secondary buttons, offers
 * no Considering, and counts nowhere as waiting.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { addDoubles } from '../../../e2e/world.mjs';
import { formatBlock } from '../../utils/format';
import { TIP } from '../../test/world';
import type { InstalledWorld } from '../../test/world';
import HomePage from '../home/HomePage';
import { AppShell } from '../../components/layout/AppShell';
import DecisionPage from './DecisionPage';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

type World = InstalledWorld['world'];
type Doubles = ReturnType<typeof addDoubles>;

/** Admin C's second proposal, confirmed at TIP - 7,000: it expires 10,081 blocks later. */
const ADMIN_C_EXPIRES = formatBlock(TIP - 7_000 + 10_081);

async function openQueue(persona = 'admin') {
  let doubles = {} as Doubles;
  const rendered = await renderPage(<DecisionsPage />, {
    persona,
    path: '/decisions',
    route: '/decisions',
    setup: (world: World) => {
      doubles = addDoubles(world);
    },
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return { ...rendered, doubles };
}

const card = (name: RegExp) => screen.getByRole('article', { name });
/** A double's note: the first note on its card (any target impact comes after it). */
const doubleNote = (el: HTMLElement) => within(el).getAllByRole('note')[0];
const ALREADY = /^Become a Minter Admin, Admin C$/;
const NOT_ADMIN = /^Remove a Minter Admin, Nora Nominator$/;
const MEMBER_9 = /^Make a Minter Admin, Member 9$/;

describe('Doubles on the Decisions page', () => {
  it('marks each double with a chip and a note that says why, and when it runs out', async () => {
    await openQueue();
    const already = card(ALREADY);
    expect(within(already).getByText('Double').closest('.MuiChip-root')).toHaveTextContent(
      'Double: changes nothing'
    );
    const note = doubleNote(already);
    expect(note).toHaveTextContent(
      'Admin C is already a Minter Admin, from an earlier proposal. If this one passes, nothing changes, so there’s no need to sign it.'
    );
    expect(note).toHaveTextContent(
      new RegExp(`It runs out by itself at ${ADMIN_C_EXPIRES} \\(about .+\\)\\.$`)
    );

    const notAdmin = card(NOT_ADMIN);
    expect(within(notAdmin).getByText('Double')).toBeInTheDocument();
    expect(doubleNote(notAdmin)).toHaveTextContent(
      /^Nora Nominator isn’t a Minter Admin, so removing them changes nothing\. There’s no need to sign it\. It runs out by itself at block/
    );
  });

  it('points the newer of two same changes to the older one, which is no double', async () => {
    const { doubles } = await openQueue();
    const [older, newer] = screen.getAllByRole('article', { name: MEMBER_9 });
    expect(within(older).queryByText('Double')).toBeNull();
    expect(within(newer).getByText('Double').closest('.MuiChip-root')).toHaveTextContent(
      'Double: the same change is already waiting'
    );
    expect(doubleNote(newer)).toHaveTextContent(
      /^The same change is already waiting in an earlier proposal: answer that one instead\. Once one of them passes, the other changes nothing\. This one runs out by itself at block/
    );
    expect(
      within(newer).getByRole('link', {
        name: 'The earlier proposal: Make a Minter Admin, Member 9',
      })
    ).toHaveAttribute('href', `/decisions/${doubles.duplicate.older}`);
  });

  it('keeps Sign and Reject secondary on a double, with no Considering', async () => {
    await openQueue();
    const already = card(ALREADY);
    expect(within(already).getByRole('button', { name: /^Sign: / })).toHaveClass(
      'MuiButton-outlined'
    );
    expect(within(already).getByRole('button', { name: /^Reject: / })).toBeVisible();
    expect(within(already).queryByRole('button', { name: /^Considering: / })).toBeNull();
    // A real decision keeps its main Sign, and Considering.
    const real = card(/Add to MINTER, bob\+builder/);
    expect(within(real).getByRole('button', { name: /^Sign: / })).toHaveClass(
      'MuiButton-contained'
    );
    expect(
      await within(real).findByRole('button', { name: /^Considering: / }, T)
    ).toBeInTheDocument();
  });

  it('sorts doubles after the real decisions, still in the queue', async () => {
    await openQueue();
    const section = screen.getByRole('region', { name: /^Collecting signatures/ });
    const titles = within(section)
      .getAllByRole('article')
      .map((a) => a.getAttribute('aria-label'));
    const doubles = titles.slice(-3);
    expect(doubles).toEqual([
      'Become a Minter Admin, Admin C',
      'Remove a Minter Admin, Nora Nominator',
      'Make a Minter Admin, Member 9',
    ]);
    // The older Member 9 addition is a real decision, before them.
    expect(titles.indexOf('Make a Minter Admin, Member 9')).toBeLessThan(titles.length - 3);
  });

  it('doesn’t count them as waiting, and says so quietly', async () => {
    await openQueue();
    // Six as before, plus the older Member 9 addition; the three doubles don't count.
    expect(screen.getByText('7 decisions waiting for your signature')).toBeInTheDocument();
    expect(
      screen.getByText('Plus 3 doubles, marked on their cards: no need to sign them.')
    ).toBeVisible();
  });
});

describe('Doubles and Sign several', () => {
  it('leaves doubles out, with the reason, on their cards and in the run', async () => {
    const u = user();
    await openQueue();
    await u.click(screen.getByRole('button', { name: 'Sign several' }));
    // No box to tick on a double: it says why.
    const already = card(ALREADY);
    expect(within(already).queryByRole('checkbox')).toBeNull();
    expect(
      within(already).getByText('Left out: a double, it changes nothing.')
    ).toBeInTheDocument();
    const newer = screen.getAllByRole('article', { name: MEMBER_9 })[1];
    expect(
      within(newer).getByText('Left out: a double, the same change is already waiting.')
    ).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('7 of 7 selected')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Sign 7' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign several' });
    expect(within(dialog).getByText(/7 Hub confirmations, one for each/)).toBeVisible();
    expect(within(dialog).getByText('Not in this run:')).toBeVisible();
    expect(
      within(dialog).getByText(
        'Become a Minter Admin: Admin C. Left out: a double, it changes nothing.'
      )
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        'Remove a Minter Admin: Nora Nominator. Left out: a double, it changes nothing.'
      )
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        'Make a Minter Admin: Member 9. Left out: a double, the same change is already waiting.'
      )
    ).toBeVisible();
    // The run itself holds the seven real ones only.
    expect(
      within(within(dialog).getByRole('list', { name: 'Progress' })).getAllByRole('listitem')
    ).toHaveLength(7);
  }, 20_000);
});

describe('A double’s own page', () => {
  function openDecision(pick: (d: Doubles) => string, persona = 'admin') {
    let path = '';
    return renderPage(<DecisionPage />, {
      persona,
      route: '/decisions/:signature',
      get path() {
        return path;
      },
      setup: (world: World) => {
        path = `/decisions/${pick(addDoubles(world))}`;
      },
    });
  }

  it('shows the chip, the note and a secondary Sign, as in the queue', async () => {
    await openDecision((d) => d.alreadyAdmin.signature);
    const page = await screen.findByRole('article', { name: 'Become a Minter Admin, Admin C' }, T);
    expect(within(page).getByText('Double').closest('.MuiChip-root')).toHaveTextContent(
      'Double: changes nothing'
    );
    expect(doubleNote(page)).toHaveTextContent(
      /^Admin C is already a Minter Admin, from an earlier proposal\./
    );
    expect(within(page).getByRole('button', { name: /^Sign: / })).toHaveClass('MuiButton-outlined');
    expect(within(page).queryByRole('button', { name: /^Considering: / })).toBeNull();
  });

  it('links the newer of two same changes to the older one', async () => {
    let older = '';
    await openDecision((d) => {
      older = d.duplicate.older;
      return d.duplicate.signature;
    });
    const page = await screen.findByRole('article', { name: 'Make a Minter Admin, Member 9' }, T);
    expect(
      within(page).getByRole('link', {
        name: 'The earlier proposal: Make a Minter Admin, Member 9',
      })
    ).toHaveAttribute('href', `/decisions/${older}`);
  });

  it('is shown to members too, read-only', async () => {
    await openDecision((d) => d.notAdmin.signature, 'learner');
    const page = await screen.findByRole(
      'article',
      { name: 'Remove a Minter Admin, Nora Nominator' },
      T
    );
    expect(within(page).getByText('Double')).toBeInTheDocument();
    expect(doubleNote(page)).toHaveTextContent(/isn’t a Minter Admin/);
    expect(within(page).queryByRole('button', { name: /^Sign: / })).toBeNull();
  });
});

describe('Doubles don’t count on Home or in the navigation', () => {
  it('Home: the waiting count and the activity leave them out', async () => {
    await renderPage(<HomePage />, {
      persona: 'admin',
      setup: (world: World) => void addDoubles(world),
    });
    // Six as without doubles, plus the older Member 9 addition.
    await screen.findByRole(
      'heading',
      { level: 2, name: 'Avery Admin, 7 decisions are waiting for your signature' },
      T
    );
    const waiting = screen.getByRole('region', { name: 'Waiting for your signature' });
    expect(within(waiting).getByRole('link', { name: 'See all 7' })).toBeVisible();
    const activity = screen.getByRole('region', { name: 'Your activity' });
    expect(within(activity).getByText('2 of 9')).toBeInTheDocument();
  });

  it('the Decisions badge counts the same', async () => {
    await renderPage(<AppShell />, {
      persona: 'admin',
      setup: (world: World) => void addDoubles(world),
    });
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('button', { name: /^Decisions, 7 waiting for you$/ }).length
        ).toBeGreaterThan(0),
      T
    );
  });
});
