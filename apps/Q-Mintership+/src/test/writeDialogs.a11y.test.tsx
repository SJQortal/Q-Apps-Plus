/**
 * Every write dialog, keyboard only: opened from its button with Enter,
 * focus goes into it and stays there, every control has a name, axe finds
 * nothing, and Escape puts focus back where it came from.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addComments, addCommunityVotes, addReady } from '../../e2e/world.mjs';
import { CommentsSection } from '../components/comments/CommentsSection';
import { commentTarget } from '../data/commentThread';
import DecisionsPage from '../pages/decisions/DecisionsPage';
import ProposePage from '../pages/decisions/propose/ProposePage';
import { SUBMIT_LABEL } from '../pages/decisions/propose/proposePageWords';
import { PROPOSE_KINDS } from '../pages/decisions/proposeKinds';
import HomePage from '../pages/home/HomePage';
import NominatePage from '../pages/nominations/NominatePage';
import AccountPage from '../pages/explorer/AccountPage';
import { explorerAccountPath, proposePath, type ProposePageKind } from '../routes/paths';
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
    path: '/decisions?show=decisions',
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
      within(bob()).getByRole('button', { name: /^Approve: / }),
      'Approve this decision',
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

  it('Reject after approving', async () => {
    const u = user();
    await decisions();
    await checkDialogByKeyboard(
      u,
      within(card(/Uma Urgent/)).getByRole('button', { name: /^Reject: / }),
      'Reject after approving'
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

  it('First approval', async () => {
    const u = user();
    await decisions();
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('button', { name: /^First approval: / }, T),
      /^First approval: /
    );
  });

  it('Approve several', async () => {
    const u = user();
    await decisions();
    await u.click(screen.getByRole('button', { name: 'Approve several' }));
    await u.click(screen.getByRole('checkbox', { name: /bob\+builder/ }));
    await checkDialogByKeyboard(
      u,
      screen.getByRole('button', { name: 'Approve 1' }),
      'Approve several'
    );
  });
});

describe('The + Propose pages by keyboard', () => {
  /** A + Propose page (Simon, 2026-10-18: a page each, as Propose nomination is). */
  async function page(
    kind: ProposePageKind,
    options: { who?: string; setup?: RenderPageOptions['setup'] } = {}
  ) {
    const rendered = await renderPage(<ProposePage />, {
      persona: 'admin',
      path: proposePath(kind, options.who),
      route: '/propose/:kind',
      setup: options.setup,
    });
    await screen.findByRole('heading', { level: 1, name: PROPOSE_KINDS[kind].label }, T);
    return rendered;
  }

  it('every kind’s page: every control named, nothing for axe', async () => {
    // MINTER's members are picked with a dropdown while typing; the rest from a list.
    for (const [kind, role, name] of [
      ['kick', 'combobox', 'Member’s name or address'],
      ['decline', 'list', 'Requested to join MINTER Group'],
      ['ban', 'combobox', 'Name or Qortal address'],
      ['addAdmin', 'combobox', 'Member’s name or address'],
      ['removeAdmin', 'list', 'Minter Admins'],
      ['cancelBan', 'list', 'Bans in force'],
      ['cancelInvite', 'list', 'Approved invites'],
    ] as const) {
      const { container, unmount } = await page(kind);
      await screen.findByRole(role, { name }, T);
      await expectNamedControls(container);
      unmount();
    }
  });

  it('picking from the list moves focus to the card, whose check is one live region', async () => {
    const u = user();
    await page('removeAdmin');
    const admins = await screen.findByRole('list', { name: 'Minter Admins' }, T);
    const remove = await within(admins).findByRole(
      'button',
      { name: 'Remove Admin C as Minter Admin' },
      T
    );
    remove.focus();
    await u.keyboard('{Enter}');
    const live = (await screen.findByText('Nothing stops this proposal.', {}, T)).closest(
      '[role="status"]'
    ) as HTMLElement;
    expect(live).toBeTruthy();
    // The card took focus, so Tab goes on from who was picked.
    await waitFor(() => expect(document.activeElement).toContainElement(live));
    // Nothing inside it is a live region of its own (one region, read once).
    expect(live.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    // Change: back to the list, focus on its search.
    await u.click(screen.getByRole('button', { name: 'Change: pick someone else' }));
    await waitFor(() =>
      expect(
        screen.getByRole('searchbox', { name: 'Search the Minter Admins, by name or address' })
      ).toHaveFocus()
    );
  });

  it('Decline a join request: the list of who asked, then the card and on to the reason, by keyboard', async () => {
    const u = user();
    await page('decline', { setup: (world) => addReady(world) });
    const list = await screen.findByRole('list', { name: 'Requested to join MINTER Group' }, T);
    const decline = await within(list).findByRole(
      'button',
      { name: 'Decline Rae Ready’s join request' },
      T
    );
    decline.focus();
    await u.keyboard('{Enter}');
    // The person is picked: focus is on their card, with Change; the reason comes next.
    await waitFor(() =>
      expect(document.activeElement).toContainElement(screen.getByText('Rae Ready'))
    );
    expect(screen.getByRole('button', { name: 'Change: pick someone else' })).toBeVisible();
    const reason = screen.getByRole('textbox', { name: 'Reason' });
    for (let i = 0; i < 8 && document.activeElement !== reason; i++) await u.tab();
    expect(reason).toHaveFocus();
  });

  it('picking yourself to remove says where Step down is, in the card’s live region', async () => {
    const { container } = await page('removeAdmin', { who: ADDR.admin });
    const live = (
      await screen.findByText(
        /To step down, use Step down as Minter Admin on your own Minter Profile\./,
        {},
        T
      )
    ).closest('[role="status"]') as HTMLElement;
    expect(within(live).getByRole('link', { name: 'Open your Minter Profile' })).toBeVisible();
    expect(live.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    await expectNamedControls(container);
  });

  it('the proposal’s Hub step: focus in, kept in, and back on the button after Escape', async () => {
    const u = user();
    await page('kick', { who: ADDR.learner });
    await screen.findByText('Nothing stops this proposal.', {}, T);
    await u.type(screen.getByRole('textbox', { name: 'Reason' }), 'Spam in the chat.');
    const submit = screen.getByRole('button', { name: SUBMIT_LABEL.kick.named('Leo Learner') });
    const hub = await checkDialogByKeyboard(u, submit, /^Remove from MINTER: Leo Learner/, {
      reach: ['Back to the form', 'Continue to Hub'],
    });
    expect(hub).toBeTruthy();

    // Through Hub (the mock declines it) to the result, then Close: back on the button.
    submit.focus();
    await u.keyboard('{Enter}');
    const step = await screen.findByRole('dialog', { name: /^Remove from MINTER: / }, T);
    await u.click(within(step).getByRole('button', { name: 'Continue to Hub' }));
    await within(step).findByText('Cancelled in Hub. Nothing was sent.', {}, T);
    expect(within(step).getByRole('button', { name: 'Back to the form' })).toHaveFocus();
    await u.click(within(step).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(submit).toHaveFocus(), T);
  });

  it('cancelling the older invites in one go', async () => {
    const u = user();
    await page('cancelInvite');
    await checkDialogByKeyboard(
      u,
      await screen.findByRole('button', { name: /^Propose cancelling all \d+ older ones$/ }, T),
      'Cancel stale invites'
    );
  });
});

describe('Write dialogs by keyboard: one’s own page', () => {
  it('Step down as Minter Admin', async () => {
    const u = user();
    await renderPage(<AccountPage />, {
      persona: 'admin',
      path: explorerAccountPath(ADDR.admin, 'mintership'),
      route: '/explorer/account/:who/:tab?',
    });
    const opener = await screen.findByRole('button', { name: 'Step down as Minter Admin' }, T);
    await waitFor(() => expect(opener).toBeEnabled(), T);
    await checkDialogByKeyboard(u, opener, 'Step down as Minter Admin');
  });
});

describe('Write dialogs by keyboard: Home', () => {
  it('Become a Minter Admin, with its statement', async () => {
    const u = user();
    await renderPage(<HomePage />, { persona: 'nominator' });
    const opener = await screen.findByRole('button', { name: 'Become a Minter Admin' }, T);
    const dialog = await openWithKeyboard(u, opener, 'Become a Minter Admin');
    await expectNamedControls(dialog);
    await expectFocusTrapped(u, dialog, ['Not now', 'Continue to Hub']);
    const statement = within(dialog).getByRole('textbox', { name: 'A short statement (optional)' });
    // Its limit is said, not only enforced: what is cut off is never a surprise.
    expect(statement).toHaveAccessibleDescription(/0 \/ 500$/);
    await u.type(statement, 'I check Decisions every day.');
    expect(statement).toHaveAccessibleDescription(/28 \/ 500$/);
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
});

describe('Write dialogs by keyboard: nominations', () => {
  it('Add your support', async () => {
    const u = user();
    await renderPage(<DecisionsPage />, {
      persona: 'nominator',
      path: '/decisions?show=nominations',
      route: '/decisions',
    });
    const eli = await screen.findByRole('article', { name: /Nomination of Eli Early/ }, T);
    await checkDialogByKeyboard(
      u,
      within(eli).getByRole('button', { name: 'Add your support for Eli Early' }),
      'Add your support'
    );
  });

  it('A community vote, and the voters beside Copy link', async () => {
    const u = user();
    await renderPage(<DecisionsPage />, {
      persona: 'learner',
      path: '/decisions?show=nominations',
      route: '/decisions',
      setup: (world) => addCommunityVotes(world),
    });
    const bob = await screen.findByRole('article', { name: /Nomination of bob\+builder/ }, T);
    await checkDialogByKeyboard(
      u,
      await within(bob).findByRole('button', { name: 'Vote Yes: bob+builder' }, T),
      'Vote Yes',
      { reach: ['Not now', 'Continue to Hub'] }
    );
    await checkDialogByKeyboard(
      u,
      within(bob).getByRole('button', { name: /^Community votes: 5 Yes, 1 No/ }),
      'Community votes',
      { reach: ['Close'] }
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
    await within(panel).findByText(/Wren helped me set up my node/, { selector: 'p' }, T);
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
