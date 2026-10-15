/**
 * A kick of someone who asked to join and isn't a member declines their
 * join request: titled "Decline a join request" on its card, in Sign
 * several and on its own page, waiting or decided (rules/decline.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { base58Decode, base58Encode } from '../../qortal/base58';
import { DECLINED, addDecline, fakeAddress, type World } from '../../../e2e/world.mjs';
import { shortAddress } from '../../utils/format';
import DecisionPage from './DecisionPage';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const T = { timeout: 4000 };
const jr2 = shortAddress(fakeAddress('jr-2'));

function openDecision(pick: (made: ReturnType<typeof addDecline>) => string) {
  let path = '';
  return renderPage(<DecisionPage />, {
    persona: 'admin',
    route: '/decisions/:signature',
    get path() {
      return path;
    },
    setup: (world: World) => {
      path = `/decisions/${pick(addDecline(world))}`;
    },
  });
}

describe('Declines in Decisions', () => {
  it('titles a waiting decline on its card and in Approve several; a member’s removal keeps its title', async () => {
    const user = userEvent.setup();
    await renderPage(<DecisionsPage />, {
      persona: 'admin',
      path: '/decisions',
      route: '/decisions',
      setup: (world) => void addDecline(world),
    });
    const card = await screen.findByRole('article', { name: `Decline a join request, ${jr2}` }, T);
    expect(within(card).getByText('Asked to join, but no node online for months')).toBeVisible();
    expect(
      within(card).getByRole('button', { name: /^Approve: Decline a join request/ })
    ).toBeVisible();
    expect(
      screen.getByRole('article', { name: 'Remove from MINTER, Kai Target' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve several' }));
    await user.click(
      screen.getByRole('checkbox', { name: `Select to approve: Decline a join request, ${jr2}` })
    );
    await user.click(screen.getByRole('button', { name: 'Approve 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve several' });
    expect(dialog).toHaveTextContent(`Decline a join request: ${jr2}`);
  }, 20_000);

  it('its own page says so while it waits', async () => {
    await openDecision((made) => made.waiting.signature);
    expect(
      await screen.findByRole('article', { name: `Decline a join request, ${jr2}` }, T)
    ).toBeInTheDocument();
    expect(await screen.findByText(`Decline a join request: ${jr2}`, {}, T)).toBeInTheDocument();
  });

  it('and once it was approved', async () => {
    await openDecision((made) => made.declined.kick);
    expect(
      await screen.findByText(`Decline a join request: ${DECLINED.name}`, {}, T)
    ).toBeInTheDocument();
    const card = await screen.findByRole('article', { name: /^Decline a join request/ }, T);
    expect(within(card).getByText('Approved')).toBeVisible();
    expect(screen.queryByText(/Remove from MINTER/)).toBeNull();
  });
});

describe('Decisions → Propose → Decline a join request', () => {
  it('proposes it and signs it: the same kick, worded as declining, two Hub steps', async () => {
    const user = userEvent.setup();
    const { world, address, publicKey } = await renderPage(<DecisionsPage />, {
      persona: 'admin',
      path: '/decisions',
      route: '/decisions',
      setup: (w) => void addDecline(w),
    });
    const jr1 = fakeAddress('jr-1');
    const signature = base58Encode(new Uint8Array(64).fill(7));
    mockQortalRequest('KICK_FROM_GROUP', (req: Record<string, unknown>) => {
      const tx = {
        type: 'GROUP_KICK',
        timestamp: Date.now(),
        reference: base58Encode(new Uint8Array(64).fill(1)),
        signature,
        txGroupId: 694,
        groupId: 694,
        approvalStatus: 'PENDING',
        creatorAddress: address,
        adminPublicKey: publicKey,
        member: req.qortalAddress,
        reason: req.reason,
      };
      world.pending.push(tx);
      return tx;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN' }));

    await user.click(await screen.findByRole('button', { name: 'Propose' }, T));
    await user.click(await screen.findByRole('menuitem', { name: /Decline a join request/ }));
    const form = await screen.findByRole('dialog', { name: 'Decline a join request' });
    expect(
      within(form).getByText(
        /^Once 8 Minter Admins approve it, like any decision, their join request goes and they leave Ready to mint for everyone\. They can send a new join request later\. It costs 0\.02 QORT: your proposal and your own approval of it, two Hub steps\.$/
      )
    ).toBeVisible();

    // A decline already waiting stops a second one.
    const name = within(form).getByRole('textbox', { name: 'Name or address' });
    await user.type(name, fakeAddress('jr-2'));
    await user.click(within(form).getByRole('button', { name: 'Find' }));
    expect(
      await within(form).findByText(
        'Declining this join request is already waiting for approvals.',
        {},
        T
      )
    ).toBeVisible();
    expect(within(form).getByRole('button', { name: 'Review' })).toBeDisabled();

    await user.clear(name);
    await user.type(name, jr1);
    await user.click(within(form).getByRole('button', { name: 'Find' }));
    expect(await within(form).findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    // The reason is required, and everyone sees it.
    expect(within(form).getByText(/^Shown to everyone, the account included\./)).toBeVisible();
    await user.type(within(form).getByRole('textbox', { name: 'Reason' }), 'No node running');
    await user.click(within(form).getByRole('button', { name: 'Review' }));

    const hub = await screen.findByRole(
      'dialog',
      { name: `Decline a join request: ${shortAddress(jr1)}` },
      T
    );
    expect(within(hub).getByText('Step 1 of 2: Propose it')).toBeVisible();
    expect(within(hub).getByText('Step 2 of 2: Approve it')).toBeVisible();
    expect(within(hub).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    expect(
      within(hub).getByText(
        /^This proposes declining their join request: once it passes, they leave Ready to mint for everyone, and they can send a new one later\. It happens only if 8 Minter Admins approve within/
      )
    ).toBeVisible();
    await user.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Proposed and approved', {}, T)).toBeVisible();
    expect(qortalCallsFor('KICK_FROM_GROUP')).toEqual([
      {
        action: 'KICK_FROM_GROUP',
        groupId: 694,
        qortalAddress: jr1,
        reason: 'No node running',
        txGroupId: 694,
      },
    ]);
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(signature);
  }, 30_000);
});
