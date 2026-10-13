/**
 * Every write dialog, keyboard only: opened from its button with Enter,
 * focus goes into it and stays there, every control has a name, axe finds
 * nothing, and Escape puts focus back where it came from.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
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
