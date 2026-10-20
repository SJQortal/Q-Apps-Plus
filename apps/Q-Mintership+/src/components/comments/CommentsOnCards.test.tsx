import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addComments } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { fetchCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import { resetOptimisticComments } from '../../state/comments';
import DecisionsPage from '../../pages/decisions/DecisionsPage';
import AccountPage from '../../pages/explorer/AccountPage';
import { explorerAccountPath } from '../../routes/paths';

afterEach(() => {
  vi.useRealTimers();
  resetOptimisticComments();
});

const T = { timeout: 4000 };
let ids: Record<string, string> = {};
const setup = (world: Parameters<typeof addComments>[0]) => {
  ids = addComments(world).ids;
};

const commentSearches = () =>
  fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
    p.includes('identifier=qmp-comment-')
  );

describe('comments on the cards', () => {
  it('Decisions: every card counts from one shared search; an invite includes its nomination’s', async () => {
    const user = userEvent.setup();
    await renderPage(<DecisionsPage />, {
      persona: 'admin',
      path: '/decisions?show=decisions',
      route: '/decisions',
      setup,
    });
    const bob = await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
    const toggle = await within(bob).findByRole(
      'button',
      { name: 'Comments (3): Add to MINTER, bob+builder' },
      T
    );
    // The waiting nomination on the same page, and the other decisions, share the search.
    const wren = screen.getByRole('article', { name: 'Nomination of Wren Waiting' });
    expect(await within(wren).findByRole('button', { name: /^Comments \(8\): / }, T)).toBeVisible();
    expect(commentSearches()).toHaveLength(1);
    expect(fetchCallsFor('/arbitrary/JSON/').filter((p) => p.includes('qmp-comment-'))).toEqual([]);

    await user.click(toggle);
    const region = await within(bob).findByRole(
      'region',
      { name: 'Comments on Add to MINTER, bob+builder' },
      T
    );
    expect(
      await within(region).findByText(/Their node has been steady all month/, { selector: 'p' }, T)
    ).toBeVisible();
    expect(within(region).getByText(/answers questions in the minting chat/)).toBeVisible();
    const replies = within(region).getByRole('list', { name: 'Replies to Admin C' });
    expect(within(replies).getByText(/I see them online every day/)).toBeVisible();
    expect(document.querySelector(`[data-comment="${ids.signed}"]`)).not.toBeNull();
    // A Minter Admin's comment says what they chose (Admin C approved it); a member's doesn't.
    const adminC = document.querySelector(`[data-comment="${ids.signed}"]`) as HTMLElement;
    expect(await within(adminC).findByText('Approved', {}, T)).toBeVisible();
    expect(within(replies).queryByText(/^(Approved|Rejected|Considering)/)).toBeNull();
  });

  it('Nominations: the open cards show their comments', async () => {
    await renderPage(<DecisionsPage />, {
      persona: 'nominator',
      path: '/decisions?show=nominations',
      route: '/decisions',
      setup,
    });
    const wren = await screen.findByRole('article', { name: 'Nomination of Wren Waiting' }, T);
    expect(
      await within(wren).findByRole(
        'button',
        { name: 'Comments (8): the nomination of Wren Waiting' },
        T
      )
    ).toHaveAttribute('aria-expanded', 'false');
    const urgent = screen.getByRole('article', { name: 'Nomination of Uma Urgent' });
    expect(
      await within(urgent).findByRole('button', { name: /^Comments \(0\): / }, T)
    ).toBeVisible();
  });

  it('the person page: their nomination’s comments', async () => {
    const user = userEvent.setup();
    await renderPage(<AccountPage />, {
      persona: 'learner',
      path: explorerAccountPath(ADDR.nominatedWaiting, 'mintership'),
      route: '/explorer/account/:who/:tab?',
      setup,
    });
    const toggle = await screen.findByRole(
      'button',
      { name: 'Comments (8): the nomination of Wren Waiting' },
      { timeout: 6000 }
    );
    await user.click(toggle);
    expect(
      await screen.findByText(/Wren helped me set up my node/, { selector: 'p' }, T)
    ).toBeVisible();
    expect(document.querySelector(`[data-comment="${ids.spam}"]`)).toHaveTextContent(
      'Hidden by a Minter Admin.'
    );
  });
});
