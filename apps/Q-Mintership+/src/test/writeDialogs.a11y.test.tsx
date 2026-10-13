/**
 * Every write dialog, keyboard only: opened from its button with Enter,
 * focus goes into it and stays there, every control has a name, axe finds
 * nothing, and Escape puts focus back where it came from.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addComments } from '../../e2e/world.mjs';
import { CommentsSection } from '../components/comments/CommentsSection';
import { commentTarget } from '../data/commentThread';
import DecisionsPage from '../pages/decisions/DecisionsPage';
import HomePage from '../pages/home/HomePage';
import NominatePage from '../pages/nominations/NominatePage';
import NominationsPage from '../pages/nominations/NominationsPage';
import { resetOptimisticComments } from '../state/comments';
import {
  checkDialogByKeyboard,
  closeWithEscape,
  expectFocusTrapped,
  expectNamedControls,
  openWithKeyboard,
} from './keyboard';
import { renderPage, type RenderPageOptions } from './render';
import { ADDR, NOW } from './world';

afterEach(() => {
  vi.useRealTimers();
  resetOptimisticComments();
});

const T = { timeout: 4000 };
const user = () => userEvent.setup();
// Whole pages walked by keyboard: slow on a busy machine.
vi.setConfig({ testTimeout: 45_000 });

async function decisions(setup?: RenderPageOptions['setup']) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona: 'admin',
    path: '/decisions',
    route: '/decisions',
    setup,
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
  return rendered;
}
const card = (name: RegExp) => screen.getByRole('article', { name });

describe('Write dialogs by keyboard: a decision', () => {
  const bob = () => card(/Add to MINTER, bob\+builder/);

  it('Sign', async () => {
    const u = user();
    await decisions();
    await checkDialogByKeyboard(
      u,
      within(bob()).getByRole('button', { name: /^Sign: / }),
      'Sign this decision',
      { reach: ['Not now', 'Continue to Hub'] }
    );
  });

  it('Reject', async () => {
    const u = user();
    await decisions();
    await checkDialogByKeyboard(
      u,
      within(bob()).getByRole('button', { name: /^Reject: / }),
      'Reject this decision',
      { reach: ['Not now', 'Continue to Hub'] }
    );
  });

  it('Withdraw my signature', async () => {
    const u = user();
    await decisions();
    await checkDialogByKeyboard(
      u,
      within(card(/Uma Urgent/)).getByRole('button', { name: /^Withdraw my signature/ }),
      'Withdraw your signature'
    );
  });

  it('Considering', async () => {
    const u = user();
    await decisions();
    await checkDialogByKeyboard(
      u,
      within(bob()).getByRole('button', { name: /^Considering: / }),
      'Mark as considering'
    );
  });

  it('No longer considering', async () => {
    const u = user();
    await decisions((world) => {
      const invite = world.pending.find(
        (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
      );
      world.records.push({
        name: 'Avery Admin',
        identifier: `qmp-considering-${invite.signature.slice(0, 40)}`,
        created: Date.now() - 60_000,
        body: { v: 1, pendingSignature: invite.signature },
      });
    });
    const opener = await within(bob()).findByRole(
      'button',
      { name: /^No longer considering: / },
      T
    );
    await checkDialogByKeyboard(u, opener, 'No longer considering');
  });

  it('First signature', async () => {
    const u = user();
    await decisions();
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('button', { name: /^First signature: / }, T),
      /^First signature: /
    );
  });

  it('Sign several', async () => {
    const u = user();
    await decisions();
    await u.click(screen.getByRole('button', { name: 'Sign several' }));
    await u.click(screen.getByRole('checkbox', { name: /bob\+builder/ }));
    await checkDialogByKeyboard(u, screen.getByRole('button', { name: 'Sign 1' }), 'Sign several');
  });

  it('Propose cancelling one stale invite, and all of them', async () => {
    const u = user();
    await decisions();
    await u.click(screen.getByRole('button', { name: 'Show them' }));
    const row = await screen.findAllByRole('button', { name: /^Propose cancelling the invite/ }, T);
    await checkDialogByKeyboard(u, row[0], /^Cancel the invite for /);
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('button', { name: /^Propose cancelling all \d+ older ones$/ }, T),
      'Cancel stale invites'
    );
  });
});

describe('Write dialogs by keyboard: Propose', () => {
  /** Propose → a choice, by keyboard: the menu, arrow keys and Enter. */
  async function choose(u: ReturnType<typeof user>, label: RegExp): Promise<HTMLElement> {
    const propose = screen.getByRole('button', { name: 'Propose' });
    propose.focus();
    await u.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', {}, T);
    const items = within(menu).getAllByRole('menuitem');
    const index = items.findIndex((item) => label.test(item.textContent ?? ''));
    expect(index).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < index; i++) await u.keyboard('{ArrowDown}');
    expect(items[index]).toHaveFocus();
    await u.keyboard('{Enter}');
    return propose;
  }

  it('every kind’s form: focus in, kept in, and back on Propose after Escape', async () => {
    const u = user();
    await decisions();
    for (const [label, title] of [
      [/^Remove a member/, 'Remove a member'],
      [/^Ban an account/, 'Ban an account'],
      [/^Make a Minter Admin/, 'Make a Minter Admin'],
      [/^Remove a Minter Admin/, 'Remove a Minter Admin'],
      [/^Lift a ban/, 'Lift a ban'],
      [/^Cancel an approved invite/, 'Cancel an approved invite'],
    ] as const) {
      const propose = await choose(u, label);
      const dialog = await screen.findByRole('dialog', { name: title }, T);
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
      await expectNamedControls(dialog);
      await expectFocusTrapped(u, dialog, ['Cancel']);
      await closeWithEscape(u, () => propose);
    }
  });

  it('the Hub step after Review, and its result, put focus back on Propose', async () => {
    const u = user();
    await decisions();
    const propose = await choose(u, /^Remove a member/);
    const form = await screen.findByRole('dialog', { name: 'Remove a member' }, T);
    await u.type(within(form).getByRole('textbox', { name: 'Name or address' }), 'Leo Learner');
    await u.keyboard('{Enter}');
    await within(form).findByText('Nothing stops this proposal.', {}, T);
    await u.type(within(form).getByRole('textbox', { name: 'Reason' }), 'Spam in the chat.');
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    const hub = await screen.findByRole('dialog', { name: /^Remove from MINTER: Leo Learner/ }, T);
    await waitFor(() => expect(hub).toContainElement(document.activeElement as HTMLElement));
    await expectNamedControls(hub);
    await expectFocusTrapped(u, hub, ['Back to the form', 'Continue to Hub']);
    await closeWithEscape(u, () => propose);

    // Through Hub (the mock declines it) to the result, then Close.
    await choose(u, /^Remove a member/);
    const again = await screen.findByRole('dialog', { name: 'Remove a member' }, T);
    await u.type(within(again).getByRole('textbox', { name: 'Name or address' }), 'Leo Learner');
    await u.keyboard('{Enter}');
    await within(again).findByText('Nothing stops this proposal.', {}, T);
    await u.type(within(again).getByRole('textbox', { name: 'Reason' }), 'Spam in the chat.');
    await u.click(within(again).getByRole('button', { name: 'Review' }));
    const step = await screen.findByRole('dialog', { name: /^Remove from MINTER: / }, T);
    await u.click(within(step).getByRole('button', { name: 'Continue to Hub' }));
    await within(step).findByText('Cancelled in Hub. Nothing was sent.', {}, T);
    expect(within(step).getByRole('button', { name: 'Back to the form' })).toHaveFocus();
    await u.click(within(step).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(propose).toHaveFocus(), T);
  });
});

describe('Write dialogs by keyboard: Home', () => {
  it('Step down as Minter Admin', async () => {
    const u = user();
    await renderPage(<HomePage />, { persona: 'admin' });
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('button', { name: 'Step down as Minter Admin' }, T),
      'Step down as Minter Admin'
    );
  });

  it('Become a Minter Admin, with its statement', async () => {
    const u = user();
    await renderPage(<HomePage />, { persona: 'nominator' });
    const opener = await screen.findByRole('button', { name: 'Become a Minter Admin' }, T);
    const dialog = await openWithKeyboard(u, opener, 'Become a Minter Admin');
    await expectNamedControls(dialog);
    await expectFocusTrapped(u, dialog, ['Not now', 'Continue to Hub']);
    expect(
      within(dialog).getByRole('textbox', { name: 'A short statement (optional)' })
    ).toBeVisible();
    await closeWithEscape(u, () => opener);
  });

  it('Accept nomination', async () => {
    const u = user();
    await renderPage(<HomePage />, { persona: 'nominatedWaiting' });
    await checkDialogByKeyboard(
      u,
      (await screen.findAllByRole('button', { name: 'Accept nomination' }, T))[0],
      'Accept your nomination'
    );
  });

  it('Join now', async () => {
    const u = user();
    await renderPage(<HomePage />, { persona: 'approved' });
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('button', { name: 'Join now' }, T),
      'Join MINTER'
    );
  });

  it('Show you’re ready to mint', async () => {
    const u = user();
    await renderPage(<HomePage />, { persona: 'newcomerName' });
    await checkDialogByKeyboard(
      u,
      (await screen.findAllByRole('button', { name: /^Show you.re ready to mint$/ }, T))[0],
      /^Show you.re ready to mint$/
    );
  });
});

describe('Write dialogs by keyboard: nominations', () => {
  it('Add your support', async () => {
    const u = user();
    await renderPage(<NominationsPage />, {
      persona: 'nominator',
      path: '/nominations',
      route: '/nominations',
    });
    const eli = await screen.findByRole('article', { name: /Nomination of Eli Early/ }, T);
    await checkDialogByKeyboard(
      u,
      within(eli).getByRole('button', { name: /Add your support/ }),
      'Add your support'
    );
  });

  it('Propose nomination: the publish step', async () => {
    const u = user();
    await renderPage(<NominatePage />, {
      persona: 'nominator',
      path: `/nominate?who=${ADDR.newcomerName}`,
      route: '/nominate',
    });
    await screen.findByText(/Can be nominated/, {}, T);
    await u.type(
      screen.getByRole('textbox', { name: /Why should they mint/ }),
      'Runs a reliable node and answers questions in the minting chat every week.'
    );
    await checkDialogByKeyboard(
      u,
      screen.getByRole('button', { name: /^Propose nomination/ }),
      'Publish your nomination'
    );
  });
});

describe('Write dialogs by keyboard: comments', () => {
  const LABEL = 'the nomination of Wren Waiting';
  const DAY = 86_400_000;
  async function comments(persona: string) {
    let ids: Record<string, string> = {};
    await renderPage(
      <CommentsSection
        target={commentTarget('nomination', ADDR.nominatedWaiting, NOW - 40 * DAY)}
        label={LABEL}
        defaultOpen
      />,
      { persona, setup: (world) => (ids = addComments(world).ids) }
    );
    const panel = await screen.findByRole('region', { name: `Comments on ${LABEL}` }, T);
    await within(panel).findByText(/Wren helped me set up my node/, {}, T);
    const li = (id: string) => document.querySelector<HTMLElement>(`[data-comment="${ids[id]}"]`)!;
    return { panel, ids, li };
  }

  it('Post and Reply', async () => {
    const u = user();
    const { panel, li } = await comments('nominator');
    await u.type(within(panel).getByRole('textbox', { name: 'Write a comment' }), 'Steady node.');
    await checkDialogByKeyboard(
      u,
      within(panel).getByRole('button', { name: 'Post' }),
      'Post your comment'
    );
    await u.click(within(li('answer')).getByRole('button', { name: 'Reply to Wren Waiting' }));
    await u.keyboard('Good to know.');
    await checkDialogByKeyboard(
      u,
      within(panel).getByRole('button', { name: 'Post reply' }),
      'Post your reply'
    );
  });

  it('Delete your own comment', async () => {
    const u = user();
    const own = await comments('nominator');
    const more = within(own.li('sameHere')).getByRole('button', {
      name: 'Comment by Nora Nominator: more actions',
    });
    await u.click(more);
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('menuitem', { name: 'Delete' }, T),
      'Delete your comment',
      { back: () => own.li('sameHere') }
    );
  });

  it('a Minter Admin’s Hide for everyone', async () => {
    const u = user();
    const { li } = await comments('admin');
    await u.click(
      within(li('helped')).getAllByRole('button', { name: 'Comment by Member 7: more actions' })[0]
    );
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('menuitem', { name: 'Hide for everyone' }, T),
      'Hide this comment for everyone',
      { back: () => li('helped') }
    );
  });
});
