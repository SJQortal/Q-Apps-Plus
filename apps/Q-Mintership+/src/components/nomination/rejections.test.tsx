/**
 * Rejections where nominees and everyone else look: the nomination card and
 * the nominee's Home say how many Minter Admins rejected it, against the
 * same target as signatures, and when enough did.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { ADDR, TIP, type InstalledWorld } from '../../test/world';
import { fakeAddress } from '../../../e2e/world.mjs';
import { base58Encode } from '../../qortal/base58';
import { useChainNow, useNominations } from '../../hooks/useData';
import HomePage from '../../pages/home/HomePage';
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
  });

  it("the nominee's Home says how many rejected it so far", async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 1),
    });
    expect(
      await screen.findByText(
        /has rejected it so far\. It ends as rejected only if/,
        {},
        {
          timeout: 4000,
        }
      )
    ).toBeVisible();
  });

  it("the nominee's Home says when enough have rejected it", async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => rejectInvite(world, ADDR.nominatedSigning, 8),
    });
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Enough Minter Admins have rejected your nomination' },
        { timeout: 4000 }
      )
    ).toBeVisible();
    expect(screen.getByText(/You can be nominated again later\./)).toBeVisible();
  });
});
