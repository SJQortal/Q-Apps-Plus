/**
 * One person's nomination (/nominations/<address>), its shareable link:
 * the nomination in full, its rounds and how each ended, the viewer's own
 * part, and the empty and name cases.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { fetchCalls, qortalCalls } from '../../test/setup';
import { ADDR, PEOPLE, TIP, type InstalledWorld } from '../../test/world';
import { fakeAddress } from '../../../e2e/world.mjs';
import { base58Encode } from '../../qortal/base58';
import NominationPage from './NominationPage';

afterEach(() => vi.useRealTimers());

const T = { timeout: 4000 };
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH/;

function open(who: string, persona = 'nominator', setup?: (world: World) => void) {
  return renderPage(<NominationPage />, {
    persona,
    path: `/nominations/${encodeURIComponent(who)}`,
    route: '/nominations/:address',
    setup,
  });
}

type World = InstalledWorld['world'];

/** Two confirmed rejections of the nominee's pending invite, by admins who didn't sign it. */
function rejectTwice(world: World, nominee: string) {
  const invite = world.pending.find((t: { invitee?: string }) => t.invitee === nominee);
  for (let i = 0; i < 2; i++) {
    const admin = fakeAddress(`admin-${10 + i}`);
    world.approvals.push({
      type: 'GROUP_APPROVAL',
      timestamp: invite.timestamp + 60_000 * (i + 1),
      signature: base58Encode(new Uint8Array(64).fill(100 + i)),
      txGroupId: 0,
      blockHeight: TIP - 100 + i,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: admin,
      adminPublicKey: world.accounts.get(admin).publicKey,
      pendingSignature: invite.signature,
      approval: false,
    });
  }
}

describe('A nomination’s own page', () => {
  it('shows a nomination being signed, its round and links to its decision', async () => {
    const { world } = await open(ADDR.nominatedSigning, 'admin');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(within(current).getByText('Collecting approvals')).toBeInTheDocument();
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
      'ends when enough of them approve, as many reject it, or the time runs out.'
    );
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('Round 1')).toBeInTheDocument();
    expect(within(items[0]).getByText('Collecting approvals')).toBeInTheDocument();
    expect(
      within(items[0]).getByRole('link', { name: 'Open the decision of round 1' })
    ).toHaveAttribute('href', `/decisions/${invite.signature}`);
    // In the Explorer: the nominee's Minter Profile, and the nominee beside the nominator.
    expect(screen.getByRole('link', { name: 'Open Minter Profile: bob+builder' })).toHaveAttribute(
      'href',
      `/explorer/account/${ADDR.nominatedSigning}/mintership`
    );
    expect(screen.queryByRole('link', { name: /^Open in Explorer/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Compare nominee and nominator' })).toHaveAttribute(
      'href',
      `/explorer/compare/${ADDR.nominatedSigning}/${ADDR.nominator}`
    );
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
    expect(fetchCalls.some((p) => /limit=0(&|$)/.test(p))).toBe(false);
  });

  it('shows how an expired round ended, and that a new nomination is possible', async () => {
    await open(ADDR.expired, 'learner');
    const latest = await screen.findByRole('region', { name: 'Latest nomination' }, T);
    expect(within(latest).getByText('Expired')).toBeInTheDocument();
    // When it ended, on the card.
    expect(within(latest).getByText(/^Expired \d+ days ago\.$/)).toBeInTheDocument();
    // Below level 5: nothing to propose.
    expect(within(latest).queryByRole('link', { name: /again$/ })).toBeNull();
    const rounds = await screen.findByRole('region', { name: 'Rounds' }, T);
    expect(
      await within(rounds).findByText(
        /^Not enough approvals in time\. They can be nominated again\. Expired /,
        {},
        T
      )
    ).toBeInTheDocument();
  });

  it('offers Propose nomination again where a round ran out, to those who can nominate', async () => {
    for (const who of [ADDR.expired, ADDR.lapsed]) {
      const { unmount } = await open(who, 'nominator');
      const latest = await screen.findByRole('region', { name: 'Latest nomination' }, T);
      expect(
        within(latest).getByRole('link', { name: 'Propose nomination again' })
      ).toHaveAttribute('href', `/nominate?who=${who}`);
      unmount();
    }
    // Not while one is open.
    await open(ADDR.nominatedSigning, 'nominator');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(within(current).queryByRole('link', { name: 'Propose nomination again' })).toBeNull();
  });

  it('offers an eligible viewer their support while it waits for a first approval', async () => {
    await open(ADDR.nominatedWaiting, 'admin');
    const current = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(within(current).getByRole('link', { name: 'Add your support' })).toHaveAttribute(
      'href',
      `/nominate?who=${ADDR.nominatedWaiting}`
    );
    expect(
      within(current).getByRole('link', { name: 'First approval in Decisions' })
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

  it('says rejections gently to the nominee their link is for; others read them as before', async () => {
    const own = await open(ADDR.nominatedSigning, 'nominatedSigning', (world) =>
      rejectTwice(world, ADDR.nominatedSigning)
    );
    const mine = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(
      await within(mine).findByText(
        '2 Minter Admins have said no so far, of the 8 it takes to end it.',
        {},
        T
      )
    ).toBeVisible();
    expect(within(mine).getByRole('article')).not.toHaveTextContent(/rejection/i);
    own.unmount();

    await open(ADDR.nominatedSigning, 'admin', (world) =>
      rejectTwice(world, ADDR.nominatedSigning)
    );
    const theirs = await screen.findByRole('region', { name: 'Nomination' }, T);
    expect(
      await within(theirs).findByText('2 rejections of the 8 that would end it.', {}, T)
    ).toBeVisible();
  });

  it('says when nobody has nominated someone, and offers to', async () => {
    await open(ADDR.newcomerName, 'nominator');
    expect(await screen.findByText('No nomination for this person', {}, T)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Propose nomination' })).toBeVisible();
    // Their Minter Profile; no nominator to compare with.
    expect(screen.getByRole('link', { name: 'Open Minter Profile: Zoë Newcomer' })).toHaveAttribute(
      'href',
      `/explorer/account/${ADDR.newcomerName}/mintership`
    );
    expect(screen.queryByRole('link', { name: 'Compare nominee and nominator' })).toBeNull();
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
