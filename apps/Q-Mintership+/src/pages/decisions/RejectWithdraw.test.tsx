import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { ADDR, TIP } from '../../test/world';
import { addRejections } from '../../../e2e/world.mjs';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { base58Decode, base58Encode } from '../../qortal/base58';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

async function openPage(persona = 'admin', setup?: RenderPageOptions['setup']) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona,
    path: '/decisions?show=decisions',
    route: '/decisions',
    setup,
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return rendered;
}

const card = (name: RegExp) => screen.getByRole('article', { name });

describe('Decisions: Approve and Reject', () => {
  it('offers Reject next to Approve, and Reject alone where the admin has approved', async () => {
    await openPage('admin');
    const open = card(/bob\+builder/);
    expect(within(open).getByRole('button', { name: /^Reject: / })).toBeVisible();
    expect(within(open).getByRole('button', { name: /^Approve: / })).toBeVisible();
    expect(within(open).queryByText(/^You approved/)).toBeNull();
    const approved = await screen.findByRole('article', { name: /Uma Urgent/ });
    expect(within(approved).getByText('You approved ✓')).toBeInTheDocument();
    expect(within(approved).getByRole('button', { name: /^Reject: / })).toBeVisible();
    expect(within(approved).queryByRole('button', { name: /^Approve: / })).toBeNull();
    // Too late: neither.
    const late = await screen.findByRole('article', { name: /Lars Late/ });
    expect(within(late).queryByRole('button', { name: /^Reject: / })).toBeNull();
  });

  it('names an admin change its subject proposed as its card does', async () => {
    const u = user();
    await openPage('admin', (world) => {
      const remove = world.pending.find((t: { type: string }) => t.type === 'REMOVE_GROUP_ADMIN');
      // Juniper L4 steps down (in a block, so it can be answered).
      world.pending.push({
        ...remove,
        signature: base58Encode(new Uint8Array(64).fill(31)),
        creatorAddress: ADDR.adminL4,
        admin: ADDR.adminL4,
        blockHeight: TIP - 50,
      });
    });
    const steps = await screen.findByRole('article', {
      name: 'Step down as Minter Admin, Juniper L4',
    });
    await u.click(within(steps).getByRole('button', { name: /^Reject: / }));
    let dialog = await screen.findByRole('dialog', {}, T);
    expect(within(dialog).getByText('Step down as Minter Admin: Juniper L4')).toBeVisible();
    expect(within(dialog).queryByText(/^Remove a Minter Admin/)).toBeNull();
    await u.click(within(dialog).getByRole('button', { name: 'Not now' }));
    const pia = await screen.findByRole('article', { name: 'Become a Minter Admin, Pia Promote' });
    await u.click(await within(pia).findByRole('button', { name: /^Reject: / }, T));
    dialog = await screen.findByRole('dialog', {}, T);
    expect(
      await within(dialog).findByText('Become a Minter Admin: Pia Promote', {}, T)
    ).toBeVisible();
  }, 20_000);

  it('is read-only for members: no Reject, no Withdraw', async () => {
    await openPage('nominator');
    expect(screen.queryByRole('button', { name: /^Reject: / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Withdraw my signature/ })).toBeNull();
  });

  it('explains a rejection and its fee before Hub, then shows Rejected (confirming…)', async () => {
    const u = user();
    const { world } = await openPage('admin');
    const pending = world.pending.find(
      (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
    ).signature as string;
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'R1' }));

    await u.click(within(card(/bob\+builder/)).getByRole('button', { name: /^Reject: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this decision' });
    expect(
      within(dialog).getByText(/if 8 Minter Admins reject it, it ends as rejected/)
    ).toBeVisible();
    expect(within(dialog).getByText(/Approvals are counted first/)).toBeVisible();
    expect(within(dialog).getByText(/doesn’t cancel anyone else’s approval/)).toBeVisible();
    expect(
      within(dialog).getByText(
        'With yours: 1 rejection of the 8 that would end it (5 of 8 approvals).'
      )
    ).toBeVisible();
    expect(within(dialog).getByText('"approval": false.')).toBeInTheDocument();
    expect(within(dialog).getByText(pending.slice(0, 8))).toBeInTheDocument();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);

    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Rejected', {}, T)).toBeInTheDocument();
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(pending);
    expect(bytes[176]).toBe(0);

    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    const after = await screen.findByRole('article', { name: /bob\+builder/ });
    expect(await within(after).findByText('You rejected (confirming…)')).toBeInTheDocument();
    expect(within(after).queryByRole('button', { name: /^Approve: / })).toBeNull();
    expect(within(after).queryByRole('button', { name: /^Reject: / })).toBeNull();
  }, 20_000);

  it('rejects after approving: says what it does and the count after it', async () => {
    const u = user();
    await openPage('admin');
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'W1' }));
    const approved = await screen.findByRole('article', { name: /Uma Urgent/ });
    await u.click(within(approved).getByRole('button', { name: /^Reject: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject after approving' });
    expect(within(dialog).getByText(/rejecting sends a rejection/)).toBeVisible();
    expect(
      within(dialog).getByText(
        'Once it is in a block: 6 of 8 approvals, and 1 rejection of the 8 that would end it.'
      )
    ).toBeVisible();
    expect(within(dialog).getByText('"approval": false.')).toBeInTheDocument();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();

    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Rejected', {}, T)).toBeInTheDocument();
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(bytes[176]).toBe(0);
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    const after = await screen.findByRole('article', { name: /Uma Urgent/ });
    expect(await within(after).findByText('You rejected (confirming…)')).toBeInTheDocument();
    expect(within(after).queryByRole('button', { name: /^Reject: / })).toBeNull();
  }, 20_000);

  it('a cancel in Hub sends nothing and keeps the buttons', async () => {
    const u = user();
    await openPage('admin');
    await u.click(within(card(/bob\+builder/)).getByRole('button', { name: /^Reject: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject this decision' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText(/Cancelled in Hub. Nothing was sent./, {}, T)
    ).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(
      await within(await screen.findByRole('article', { name: /bob\+builder/ })).findByRole(
        'button',
        { name: /^Reject: / }
      )
    ).toBeVisible();
  }, 20_000);
});

describe('Decisions: rejections on the cards', () => {
  it('shows who rejected, who had approved first, and rejections against the target', async () => {
    await openPage('learner', (world) => addRejections(world));
    const kick = await screen.findByRole('article', { name: /Remove from MINTER, Kai Target/ });
    expect(within(kick).getByRole('img', { name: '1 of 8 approvals' })).toBeInTheDocument();
    const rejected = within(kick).getByRole('list', { name: 'Rejected by 2 Minter Admins' });
    expect(within(rejected).getAllByRole('listitem')).toHaveLength(2);
    expect(within(rejected).getByText('approved first')).toBeInTheDocument();
    expect(
      within(kick).getByText(
        'Rejections: 2 of the 8 that would end it. If approvals and rejections both reach 8, it passes: Core counts approvals first.'
      )
    ).toBeVisible();
    // A rejection still on its way.
    const ban = card(/Ban from MINTER, Ben Target/);
    expect(within(ban).getByRole('heading', { name: /^Rejected/ })).toHaveTextContent(
      '(+1 confirming)'
    );
    expect(within(ban).getByText('confirming…')).toBeInTheDocument();
    // Enough rejections: Core ends it.
    const lift = card(/^Lift a ban/);
    expect(within(lift).getByText('Enough rejections')).toBeInTheDocument();
    expect(
      within(lift).getByText(
        'Enough rejections: Core ends it as rejected in the next block. It can be proposed again.'
      )
    ).toBeVisible();
  });

  it("shows an admin's own rejection, and Approve still replaces it", async () => {
    await openPage('admin', (world) => {
      const kick = world.pending.find((t: { type: string }) => t.type === 'GROUP_KICK');
      world.approvals.push({
        type: 'GROUP_APPROVAL',
        timestamp: kick.timestamp + 120_000,
        signature: base58Encode(new Uint8Array(64).fill(31)),
        txGroupId: 0,
        blockHeight: kick.blockHeight + 2,
        approvalStatus: 'NOT_REQUIRED',
        creatorAddress: ADDR.admin,
        adminPublicKey: world.accounts.get(ADDR.admin).publicKey,
        pendingSignature: kick.signature,
        approval: false,
      });
    });
    const kick = await screen.findByRole('article', { name: /Remove from MINTER, Kai Target/ });
    expect(within(kick).getByText('You rejected')).toBeInTheDocument();
    expect(
      within(kick).getByText(/You rejected this\. Approving replaces your rejection/)
    ).toBeVisible();
    expect(within(kick).getByRole('button', { name: /^Approve: / })).toBeVisible();
    expect(within(kick).queryByRole('button', { name: /^Reject: / })).toBeNull();
    // It isn't waiting for this admin any more.
    expect(screen.getByText('5 decisions waiting for your answer')).toBeInTheDocument();
  });
});

describe('Decisions: the help says what Reject does', () => {
  it('How approving works explains it, also after approving, with the target', async () => {
    const u = user();
    await openPage('admin');
    await u.click(screen.getByRole('button', { name: 'How approving works' }));
    expect(screen.getByText(/If you don’t agree, press Reject, or do nothing/)).toBeVisible();
    expect(screen.getByText(/8 of them end it as rejected/)).toBeVisible();
    expect(screen.getByText(/Changed your mind after approving\? Press Reject/)).toBeVisible();
    expect(screen.queryByText(/There is no reject or withdraw button/)).toBeNull();
  });
});
