/**
 * Community votes on proposals everyone may vote on: a removal, a ban and a
 * new Minter Admin (not a declined join request, a lifted ban, an admin's
 * removal or a cancelled invite), as on nominations; and Decisions in the
 * navigation of anyone who isn't a Minter Admin while one is open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDecisionVotes, addDecline } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import { resetOptimisticComments } from '../../state/comments';
import { loadPublicProposalCount } from '../../data/decisions';
import { peekQuery } from '../../data/query';
import { guardDecisionVote } from '../../writes/guards';
import DecisionsPage from '../../pages/decisions/DecisionsPage';
import { AppShell } from '../layout/AppShell';

afterEach(() => {
  vi.useRealTimers();
  resetOptimisticComments();
});

const T = { timeout: 4000 };

function openDecisions(persona: string, setup?: (world: never) => void) {
  return renderPage(<DecisionsPage />, {
    persona,
    path: '/decisions',
    route: '/decisions',
    setup: (world) => {
      addDecisionVotes(world);
      setup?.(world as never);
    },
  });
}

const card = (name: RegExp) => screen.findByRole('article', { name }, T);

function decode(data64: unknown): unknown {
  const bytes = Uint8Array.from(atob(String(data64)), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe('votes on removals, bans and new Minter Admins', () => {
  it('shows who voted on each, from the same one shared search as nominations', async () => {
    const user = userEvent.setup();
    await openDecisions('nominator');
    const kick = await card(/^Remove from MINTER, Kai Target/);
    const summary = await within(kick).findByRole(
      'button',
      { name: /^Community votes: 2 Yes, 1 No/ },
      T
    );
    expect(
      await within(await card(/^Ban from MINTER, Ben Target/)).findByRole(
        'button',
        { name: /^Community votes: 1 Yes, 1 No/ },
        T
      )
    ).toBeVisible();
    expect(
      await within(await card(/^Become a Minter Admin, Pia Promote/)).findByRole(
        'button',
        { name: /^Community votes: 2 Yes, 1 No/ },
        T
      )
    ).toBeVisible();
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('qmp-vote-')
    );
    expect(new Set(searches).size).toBe(1);

    await user.click(summary);
    const dialog = await screen.findByRole('dialog', { name: 'Community votes' });
    expect(within(dialog).getByText('Remove from MINTER: Kai Target')).toBeVisible();
    expect(within(dialog).getByRole('list', { name: 'Voted Yes: 2 people' })).toHaveTextContent(
      /Member 7.*Zoë Newcomer/
    );
    expect(within(dialog).getByRole('list', { name: 'Voted No: 1 person' })).toHaveTextContent(
      'Lou Left'
    );
    // Not Kai's own, a Minter Admin's, one from before the proposal, or a nomination vote.
    expect(dialog).not.toHaveTextContent('Admin K');
    expect(dialog).not.toHaveTextContent('Member 2');
    expect(dialog).not.toHaveTextContent('Member 1');
    expect(within(dialog).queryByText('Kai Target', { selector: 'li *' })).toBeNull();
  });

  it('offers No and Yes on them to someone who isn’t a Minter Admin, and nowhere else', async () => {
    await openDecisions('learner');
    const ban = await card(/^Ban from MINTER, Ben Target/);
    const group = await within(ban).findByRole(
      'group',
      { name: 'Your vote on Ban from MINTER: Ben Target' },
      T
    );
    expect(
      within(group).getByRole('button', { name: 'Vote Yes: Ban from MINTER: Ben Target' })
    ).toBeEnabled();
    expect(
      await within(await card(/^Remove from MINTER, Kai Target/)).findByRole(
        'group',
        { name: /^Your vote on Remove from MINTER: Kai Target/ },
        T
      )
    ).toBeVisible();
    // Leo already voted Yes on Pia.
    expect(
      await within(await card(/^Become a Minter Admin, Pia Promote/)).findByText(
        'You voted Yes ✓',
        {},
        T
      )
    ).toBeVisible();
    // Not on lifting a ban, or on cancelling an invite.
    expect(
      within(await card(/^Lift a ban/)).queryByRole('group', { name: /^Your vote on / })
    ).toBeNull();
    expect(
      within(await card(/^Cancel an approved invite/)).queryByRole('group', {
        name: /^Your vote on /,
      })
    ).toBeNull();
    expect(screen.getByText(/you can vote Yes or No and comment/)).toBeVisible();
  });

  it('a vote on a ban: what Yes means and its fee first, then its own record', async () => {
    const user = userEvent.setup();
    await openDecisions('learner');
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'V1' }));
    const ban = await card(/^Ban from MINTER, Ben Target/);
    await user.click(
      await within(ban).findByRole('button', { name: 'Vote Yes: Ban from MINTER: Ben Target' }, T)
    );
    const dialog = await screen.findByRole('dialog', { name: 'Vote Yes' });
    expect(within(dialog).getByText('Ban from MINTER: Ben Target')).toBeVisible();
    expect(
      within(dialog).getByText(/Yes means you’re for it, No that you’re against it/)
    ).toBeVisible();
    expect(within(dialog).getByText(/everyone sees it on the proposal/)).toBeVisible();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Voted Yes', {}, T)).toBeInTheDocument();
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call.name).toBe('Leo Learner');
    expect(call.service).toBe('JSON');
    expect(String(call.identifier)).toMatch(
      new RegExp(`^qmp-vote-ban-${ADDR.banTarget}-yes-[a-z0-9]{6}$`)
    );
    expect(decode(call.data64)).toEqual({
      v: 1,
      kind: 'ban',
      subjectAddress: ADDR.banTarget,
      vote: 'yes',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(
      await within(await card(/^Ban from MINTER, Ben Target/)).findByText(
        'You voted Yes ✓ (confirming…)',
        {},
        T
      )
    ).toBeVisible();
  }, 20_000);

  it('the account it is about sees the votes, with no buttons; Minter Admins answer on chain', async () => {
    await openDecisions('kickTarget');
    const own = await card(/^Remove from MINTER, Kai Target/);
    expect(
      await within(own).findByRole('button', { name: /^Community votes: 2 Yes, 1 No/ }, T)
    ).toBeVisible();
    expect(within(own).queryByRole('group', { name: /^Your vote on / })).toBeNull();
  });

  it('a declined join request takes no votes', async () => {
    await openDecisions('learner', (world) => addDecline(world));
    const decline = await card(/^Decline a join request/);
    expect(within(decline).queryByRole('group', { name: /^Your vote on / })).toBeNull();
  });

  it('the write’s own check: a name, not the account it is about, not an admin, still open', async () => {
    installWorld('learner');
    const leo = { address: ADDR.learner, publicKey: 'k', name: 'Leo Learner' };
    expect(await guardDecisionVote(leo, 'ban', ADDR.banTarget)).toBeNull();
    expect(await guardDecisionVote({ ...leo, name: null }, 'ban', ADDR.banTarget)).toMatch(
      /registered name/
    );
    expect(
      await guardDecisionVote({ ...leo, address: ADDR.kickTarget }, 'kick', ADDR.kickTarget)
    ).toBe('You can’t vote on a proposal about yourself.');
    expect(await guardDecisionVote({ ...leo, address: ADDR.admin }, 'ban', ADDR.banTarget)).toMatch(
      /Minter Admins answer on chain/
    );
    // No ban of Kai is waiting.
    expect(await guardDecisionVote(leo, 'ban', ADDR.kickTarget)).toBe(
      'This proposal isn’t open for votes any more.'
    );
  });
});

describe('Decisions in the navigation', () => {
  it('counts the open removals, bans and new Minter Admins, lightly', async () => {
    installWorld('learner');
    expect(await loadPublicProposalCount()).toBe(3);
    // No approval search: only the pending list, the group and the tip.
    expect(fetchCallsFor('/transactions/search')).toEqual([]);
  });

  it('a declined join request doesn’t count', async () => {
    const { world } = installWorld('learner');
    addDecline(world);
    expect(await loadPublicProposalCount()).toBe(3);
  });

  it('is there for someone who isn’t a Minter Admin while one is open', async () => {
    await renderPage(<AppShell />, { persona: 'learner' });
    await waitFor(
      () =>
        expect(screen.getAllByRole('button', { name: /^Decisions$/ }).length).toBeGreaterThan(0),
      T
    );
  });

  it('and not when none is open', async () => {
    await renderPage(<AppShell />, {
      persona: 'learner',
      setup: (world) => {
        world.pending = world.pending.filter(
          (t: { type: string }) => !['GROUP_KICK', 'GROUP_BAN', 'ADD_GROUP_ADMIN'].includes(t.type)
        );
      },
    });
    await screen.findAllByRole('button', { name: /^Nominations$/ }, T);
    // The light read has answered: none open.
    await waitFor(() => expect(peekQuery<number>('decisions:public')).toBe(0), T);
    expect(screen.queryAllByRole('button', { name: /^Decisions/ })).toEqual([]);
  });
});
