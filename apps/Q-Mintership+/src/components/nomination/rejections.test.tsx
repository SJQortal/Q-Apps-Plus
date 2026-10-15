/**
 * Rejections where nominees and everyone else look: the nomination card and
 * the nominee's Home say how many Minter Admins rejected it, against the
 * same target as signatures, and when enough did. The nominee reads the
 * same numbers in gentler words ("said no"); everyone else's card is as it was.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { ADDR, TIP, type InstalledWorld } from '../../test/world';
import { fakeAddress } from '../../../e2e/world.mjs';
import { base58Encode } from '../../qortal/base58';
import { useChainNow, useNominations } from '../../hooks/useData';
import HomePage from '../../pages/home/HomePage';
import PersonPage from '../../pages/person/PersonPage';
import { READY_DONE, READY_DONE_NEXT } from '../../constants/words';
import { NominationCard } from './NominationCard';

afterEach(() => vi.useRealTimers());

type World = InstalledWorld['world'];

/** `count` confirmed rejections of the nominee's pending invite, by admins who didn't sign it. */
function rejectInvite(world: World, nominee: string, count: number) {
  const invite = world.pending.find((t: { invitee?: string }) => t.invitee === nominee);
  // The invite's 5 signers are admin-0…admin-4; these admins are others.
  for (let i = 0; i < count; i++) {
    const who = fakeAddress(`admin-${10 + (i % 6)}`);
    const admin = i < 6 ? who : [ADDR.adminL4, ADDR.demote][i - 6];
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

function SigningCard() {
  const { data } = useNominations();
  const now = useChainNow();
  const n = data?.all.find((x) => x.nominee === ADDR.nominatedSigning);
  if (!n || !now.data) return null;
  return <NominationCard nomination={n} now={now.data} />;
}

describe('rejections on a nomination', () => {
  it('the card counts them against the target', async () => {
    await renderPage(<SigningCard />, {
      persona: 'learner',
      path: '/',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 2),
    });
    const card = await screen.findByRole(
      'article',
      { name: /Nomination of bob\+builder/ },
      {
        timeout: 4000,
      }
    );
    expect(within(card).getByText('2 rejections of the 8 that would end it.')).toBeVisible();
  });

  it('the card says when enough have rejected it', async () => {
    await renderPage(<SigningCard />, {
      persona: 'learner',
      path: '/',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 8),
    });
    const card = await screen.findByRole(
      'article',
      { name: /Nomination of bob\+builder/ },
      {
        timeout: 4000,
      }
    );
    expect(
      within(card).getByText(/Enough Minter Admins have rejected it: it ends as rejected/)
    ).toBeVisible();
    // No countdown "left to approve" beside it.
    expect(within(card).queryByText('left to approve')).toBeNull();
  });

  it('the card counts down while it can still be signed', async () => {
    await renderPage(<SigningCard />, {
      persona: 'learner',
      path: '/',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 2),
    });
    const card = await screen.findByRole(
      'article',
      { name: /Nomination of bob\+builder/ },
      { timeout: 4000 }
    );
    expect(within(card).getByText('left to approve')).toBeInTheDocument();
  });

  it("the nominee's Home keeps the numbers so far, said gently", async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 2),
    });
    const hero = await screen.findByRole(
      'region',
      { name: /your nomination is collecting approvals/ },
      { timeout: 4000 }
    );
    await waitFor(
      () =>
        expect(hero).toHaveTextContent(
          /2 Minter Admins have said no so far; it needs 8 to end it, and approvals are counted first\./
        ),
      { timeout: 4000 }
    );
    expect(hero).not.toHaveTextContent(/reject/i);
    // Their own card below says it the same way.
    const card = screen.getByRole('article', { name: /Nomination of bob\+builder/ });
    expect(
      within(card).getByText('2 Minter Admins have said no so far, of the 8 it takes to end it.')
    ).toBeVisible();
    expect(card).not.toHaveTextContent(/rejection/i);
  });

  it("the nominee's Home says one admin's no in the singular", async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 1),
    });
    const hero = await screen.findByRole(
      'region',
      { name: /your nomination is collecting approvals/ },
      { timeout: 4000 }
    );
    await waitFor(
      () =>
        expect(hero).toHaveTextContent(/1 Minter Admin has said no so far; it needs 8 to end it/),
      { timeout: 4000 }
    );
  });

  it("the nominee's own page says it gently; others' view of it doesn't change", async () => {
    const path = `/people/${ADDR.nominatedSigning}`;
    const own = await renderPage(<PersonPage />, {
      persona: 'nominatedSigning',
      path,
      route: '/people/:address',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 2),
    });
    const section = await screen.findByRole('region', { name: 'Nomination' }, { timeout: 4000 });
    expect(
      await within(section).findByText(
        '2 Minter Admins have said no so far, of the 8 it takes to end it.',
        {},
        { timeout: 4000 }
      )
    ).toBeVisible();
    own.unmount();
    await renderPage(<PersonPage />, {
      persona: 'admin',
      path,
      route: '/people/:address',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 2),
    });
    const theirs = await screen.findByRole('region', { name: 'Nomination' }, { timeout: 4000 });
    expect(
      await within(theirs).findByText(
        '2 rejections of the 8 that would end it.',
        {},
        { timeout: 4000 }
      )
    ).toBeVisible();
  });

  it("the nominee's Home says kindly when enough have said no", async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 8),
    });
    expect(
      await screen.findByRole(
        'heading',
        { name: "Your nomination won't go through this time" },
        { timeout: 4000 }
      )
    ).toBeVisible();
    const hero = screen.getByRole('region', { name: "Your nomination won't go through this time" });
    expect(hero).toHaveTextContent(/8 Minter Admins have said no, as many as it takes to end it\./);
    expect(hero).toHaveTextContent(
      /Your account and your level stay as they are, and you can be nominated again later\./
    );
    expect(hero).not.toHaveTextContent(/reject/i);
    const card = screen.getByRole('article', { name: /Nomination of bob\+builder/ });
    expect(within(card).getByText(/^Enough Minter Admins have said no: it closes /)).toBeVisible();
    // Nothing to accept, and no promise of getting in when the admins approve.
    expect(screen.queryByRole('button', { name: 'Accept nomination' })).toBeNull();
    expect(screen.queryByText(/Accept now so you join/)).toBeNull();
    expect(screen.queryByText(new RegExp(READY_DONE_NEXT))).toBeNull();
  });

  it('an accepted nominee isn’t told they’re in once the admins approve', async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => {
        rejectInvite(world, ADDR.nominatedSigning, 8);
        world.joinRequests.push({ groupId: 694, joiner: ADDR.nominatedSigning });
      },
    });
    await screen.findByRole(
      'heading',
      { name: "Your nomination won't go through this time" },
      { timeout: 4000 }
    );
    expect(
      await screen.findByText(new RegExp(`^${READY_DONE}`), {}, { timeout: 4000 })
    ).toBeVisible();
    expect(screen.queryByText(new RegExp(READY_DONE_NEXT))).toBeNull();
  });
});
