/**
 * One person's nomination (/nominations/<address>), its shareable link:
 * the nomination in full, its rounds and how each ended, the viewer's own
 * part, and the empty and name cases.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { fetchCalls, qortalCalls } from '../../test/setup';
import { ADDR, PEOPLE } from '../../test/world';
import NominationPage from './NominationPage';

afterEach(() => vi.useRealTimers());

const T = { timeout: 4000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH/;

function open(who: string, persona = 'nominator') {
  return renderPage(<NominationPage />, {
    persona,
    path: `/nominations/${encodeURIComponent(who)}`,
    route: '/nominations/:address',
  });
}

describe('A nomination’s own page', () => {
  it('shows a nomination being signed, its round and links to its decision', async () => {
    const { world } = await open(ADDR.nominatedSigning, 'admin');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(within(current).getByText('Collecting signatures')).toBeInTheDocument();
    expect(within(current).getByText(/Nominated by/)).toBeInTheDocument();
    const invite = world.pending.find(
      (t: { type: string; invitee?: string }) =>
        t.type === 'GROUP_INVITE' && t.invitee === ADDR.nominatedSigning
    );
    expect(within(current).getByRole('link', { name: 'Open the decision' })).toHaveAttribute(
      'href',
      `/decisions/${invite.signature}`
    );
    // The header copies the link; the card on its own page doesn't repeat it.
    expect(screen.getByRole('button', { name: 'Copy a link to this nomination' })).toBeVisible();
    expect(within(current).queryByRole('button', { name: /^Copy link/ })).toBeNull();

    const rounds = await screen.findByRole('region', { name: 'Rounds' }, T);
    const list = await within(rounds).findByRole('list', { name: 'Rounds, newest first' }, T);
    // The three ways a round ends, as the list below can show them.
    expect(rounds).toHaveTextContent(
      'ends when enough of them sign, as many reject it, or the time runs out.'
    );
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('Round 1')).toBeInTheDocument();
    expect(within(items[0]).getByText('Collecting signatures')).toBeInTheDocument();
    expect(
      within(items[0]).getByRole('link', { name: 'Open the decision of round 1' })
    ).toHaveAttribute('href', `/decisions/${invite.signature}`);
    expect(screen.getByRole('link', { name: 'Their MINTER profile and history' })).toHaveAttribute(
      'href',
      `/people/${ADDR.nominatedSigning}`
    );
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
    expect(fetchCalls.some((p) => /limit=0(&|$)/.test(p))).toBe(false);
  });

  it('shows how an expired round ended, and that a new nomination is possible', async () => {
    await open(ADDR.expired, 'learner');
    const latest = await screen.findByRole('region', { name: 'Latest nomination' }, T);
    expect(within(latest).getByText('Expired')).toBeInTheDocument();
    const rounds = await screen.findByRole('region', { name: 'Rounds' }, T);
    expect(
      await within(rounds).findByText(
        /^Not enough signatures in time\. They can be nominated again\. Expired /,
        {},
        T
      )
    ).toBeInTheDocument();
  });

  it('offers an eligible viewer their support while it waits for a first signature', async () => {
    await open(ADDR.nominatedWaiting, 'admin');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(within(current).getByRole('link', { name: 'Add your support' })).toHaveAttribute(
      'href',
      `/nominate?who=${ADDR.nominatedWaiting}`
    );
    expect(
      within(current).getByRole('link', { name: 'First signature in Decisions' })
    ).toHaveAttribute('href', '/decisions');
    const rounds = await screen.findByRole('region', { name: 'Rounds' }, T);
    expect(
      await within(rounds).findByText(/No round yet: a round starts when a Minter Admin/, {}, T)
    ).toBeInTheDocument();
  });

  it('doesn’t offer support again to the person who nominated them', async () => {
    await open(ADDR.nominatedWaiting, 'nominator');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(within(current).queryByRole('link', { name: 'Add your support' })).toBeNull();
  });

  it('gives the nominee their next step on their own nomination', async () => {
    await open(ADDR.nominatedWaiting, 'nominatedWaiting');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(
      await within(current).findByRole('button', { name: 'Accept nomination' }, T)
    ).toBeVisible();
  });

  it('says when nobody has nominated someone, and offers to', async () => {
    await open(ADDR.newcomerName, 'nominator');
    expect(await screen.findByText('No nomination for this person', {}, T)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Propose nomination' })).toBeVisible();
  });

  it('opens a name’s owner when the link holds a name', async () => {
    await open(PEOPLE.nominatedWaiting.name as string);
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(within(current).getByText('Waiting for a Minter Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy a link to this nomination' })).toBeVisible();
  });

  it('says no one was found for something that is neither an address nor a name', async () => {
    await open('not-a-name-anyone-has');
    expect(await screen.findByText('No one found.', {}, T)).toBeVisible();
  });
});
