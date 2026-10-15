import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addComments, addCommunityVotes } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import { resetOptimisticComments } from '../../state/comments';
import DecisionPage from '../../pages/decisions/DecisionPage';
import DecisionsPage from '../../pages/decisions/DecisionsPage';
import NominationsPage from '../../pages/nominations/NominationsPage';

afterEach(() => {
  vi.useRealTimers();
  resetOptimisticComments();
});

const T = { timeout: 4000 };

function openNominations(persona: string) {
  return renderPage(<NominationsPage />, {
    persona,
    path: '/nominations',
    route: '/nominations',
    setup: (world) => addCommunityVotes(world),
  });
}

const card = (name: string) => screen.findByRole('article', { name: `Nomination of ${name}` }, T);

function decode(data64: unknown): unknown {
  const bytes = Uint8Array.from(atob(String(data64)), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe('community votes on the cards', () => {
  it('shows who voted beside Copy link, from one shared search, and lists them on request', async () => {
    const user = userEvent.setup();
    await openNominations('nominator');
    const wren = await card('Wren Waiting');
    const summary = await within(wren).findByRole(
      'button',
      { name: /^Community votes: 3 Yes, 2 No/ },
      T
    );
    expect(summary).toHaveAttribute('aria-haspopup', 'dialog');
    // Right after Copy link.
    const copy = within(wren).getByRole('button', { name: /Copy link/ });
    expect(copy.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const bob = await card('bob+builder');
    expect(
      await within(bob).findByRole('button', { name: /^Community votes: 5 Yes, 1 No/ }, T)
    ).toHaveTextContent('+2');
    // Nobody voted on Uma's yet: nothing shows.
    expect(
      within(await card('Uma Urgent')).queryByRole('button', { name: /^Community/ })
    ).toBeNull();
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('qmp-vote-')
    );
    expect(new Set(searches).size).toBe(1);
    expect(fetchCallsFor('/arbitrary/JSON/').filter((p) => p.includes('qmp-vote-'))).toEqual([]);

    await user.click(summary);
    const dialog = await screen.findByRole('dialog', { name: 'Community votes' });
    const yes = within(dialog).getByRole('list', { name: 'Voted Yes: 3 people' });
    expect(yes).toHaveTextContent(/Member 7.*Zoë Newcomer.*Member 1/);
    const no = within(dialog).getByRole('list', { name: 'Voted No: 2 people' });
    expect(no).toHaveTextContent(/Lou Left.*Leo Learner/);
    // Not the Minter Admin's, the nominee's own, or the one from before this nomination.
    expect(dialog).not.toHaveTextContent('Admin K');
    expect(dialog).not.toHaveTextContent('Member 2');
    expect(within(yes).queryByText('Wren Waiting')).toBeNull();
    expect(
      within(dialog).getByText(/Advisory votes from people who aren’t Minter Admins/)
    ).toBeVisible();
  });

  it('offers No and Yes to someone who isn’t a Minter Admin, and their vote once cast', async () => {
    await openNominations('learner');
    const bob = await card('bob+builder');
    const group = await within(bob).findByRole('group', { name: 'Your vote on bob+builder' }, T);
    expect(within(group).getByRole('button', { name: 'Vote No: bob+builder' })).toBeEnabled();
    expect(within(group).getByRole('button', { name: 'Vote Yes: bob+builder' })).toBeEnabled();
    // Not once the count has decided it (Mia), nor after the last block an approval counts in (Lars).
    expect(
      within(await card('Mia Met')).queryByRole('group', { name: /^Your vote on / })
    ).toBeNull();
    expect(
      within(await card('Lars Late')).queryByRole('group', { name: /^Your vote on / })
    ).toBeNull();
    // Leo changed his vote on Wren to No.
    const wren = await card('Wren Waiting');
    expect(await within(wren).findByText('You voted No ✓', {}, T)).toBeVisible();
    expect(
      within(wren).getByRole('button', { name: 'Change to Yes: your vote on Wren Waiting' })
    ).toBeEnabled();
  });

  it('a vote: what it is and its fee first, then a new record under their name', async () => {
    const user = userEvent.setup();
    await openNominations('learner');
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'V1' }));
    const bob = await card('bob+builder');
    await user.click(await within(bob).findByRole('button', { name: 'Vote Yes: bob+builder' }, T));
    const dialog = await screen.findByRole('dialog', { name: 'Vote Yes' });
    expect(within(dialog).getByText(/It’s advisory: they decide on chain/)).toBeVisible();
    expect(within(dialog).getByText(/under your name \(Leo Learner\)/)).toBeVisible();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Voted Yes', {}, T)).toBeInTheDocument();
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call.name).toBe('Leo Learner');
    expect(call.service).toBe('JSON');
    expect(String(call.identifier)).toMatch(
      new RegExp(`^qmp-vote-${ADDR.nominatedSigning}-yes-[a-z0-9]{6}$`)
    );
    expect(decode(call.data64)).toEqual({
      v: 1,
      nomineeAddress: ADDR.nominatedSigning,
      vote: 'yes',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    const after = await card('bob+builder');
    expect(await within(after).findByText('You voted Yes ✓ (confirming…)', {}, T)).toBeVisible();
    expect(
      within(after).getByRole('button', { name: 'Change to No: your vote on bob+builder' })
    ).toBeDisabled();
  }, 20_000);

  it('an account without a name is told what a name is before anything opens in Hub', async () => {
    const user = userEvent.setup();
    await openNominations('newcomer');
    const bob = await card('bob+builder');
    await user.click(await within(bob).findByRole('button', { name: 'Vote No: bob+builder' }, T));
    const dialog = await screen.findByRole('dialog', { name: 'Vote No' });
    expect(within(dialog).getByText('Voting needs a registered name')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Register a name' })).toBeVisible();
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
  });

  it('Minter Admins see the votes but answer on chain; the nominee doesn’t vote on themselves', async () => {
    await renderPage(<DecisionsPage />, {
      persona: 'admin',
      path: '/decisions',
      route: '/decisions',
      setup: (world) => addCommunityVotes(world),
    });
    const invite = await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
    expect(
      await within(invite).findByRole('button', { name: /^Community votes: 5 Yes, 1 No/ }, T)
    ).toBeVisible();
    expect(within(invite).getByRole('button', { name: /^Approve: / })).toBeVisible();
    expect(screen.queryByRole('group', { name: /^Your vote on / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Vote (Yes|No): / })).toBeNull();
  });

  it('the nominee sees the votes on their own nomination, with no buttons to vote', async () => {
    await openNominations('nominatedWaiting');
    const own = await screen.findByRole('article', { name: 'Nomination of Wren Waiting' }, T);
    expect(
      await within(own).findByRole('button', { name: /^Community votes: 3 Yes, 2 No/ }, T)
    ).toBeVisible();
    expect(within(own).queryByRole('group', { name: /^Your vote on / })).toBeNull();
  });

  it('a decision’s own page offers the vote where Approve and Reject are for Minter Admins', async () => {
    let path = '';
    await renderPage(<DecisionPage />, {
      persona: 'learner',
      route: '/decisions/:signature',
      get path() {
        return path;
      },
      setup: (world) => {
        addCommunityVotes(world);
        const invite = world.pending.find(
          (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
        );
        path = `/decisions/${invite.signature}`;
      },
    });
    const invite = await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
    expect(
      await within(invite).findByRole('group', { name: 'Your vote on bob+builder' }, T)
    ).toBeVisible();
    expect(within(invite).queryByRole('button', { name: /^Approve: / })).toBeNull();
    // Its own page has no Copy link on the card: the votes still show.
    expect(
      within(invite).getByRole('button', { name: /^Community votes: 5 Yes, 1 No/ })
    ).toBeVisible();
  });

  it('a voter’s comment says how they voted', async () => {
    const user = userEvent.setup();
    let ids: Record<string, string> = {};
    await renderPage(<NominationsPage />, {
      persona: 'nominator',
      path: '/nominations',
      route: '/nominations',
      setup: (world) => {
        addCommunityVotes(world);
        ids = addComments(world).ids;
      },
    });
    const wren = await card('Wren Waiting');
    await user.click(
      await within(wren).findByRole(
        'button',
        { name: 'Comments (8): the nomination of Wren Waiting' },
        T
      )
    );
    await within(wren).findByText(/Wren helped me set up my node/, { selector: 'p' }, T);
    const comment = (id: string) => document.querySelector(`[data-comment="${id}"]`) as HTMLElement;
    // Member 7 voted Yes (Zoë's reply under theirs too), Lou Left No; Nora didn't vote.
    const member7 = within(comment(ids.helped)).getAllByText('Voted Yes');
    expect(member7[0]).toBeVisible();
    expect(within(comment(ids.thanks)).getByText('Voted Yes')).toBeVisible();
    expect(within(comment(ids.online)).getAllByText('Voted No')[0]).toBeVisible();
    expect(within(comment(ids.sameHere)).queryByText(/^Voted/)).toBeNull();
  });
});
