import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { ADDR } from '../../test/world';
import { createWorld } from '../../../e2e/world.mjs';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { base58Decode, base58Encode } from '../../qortal/base58';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();

async function openPage(persona = 'admin', path = '/decisions') {
  const rendered = await renderPage(<DecisionsPage />, { persona, path, route: '/decisions' });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return rendered;
}

const card = (name: RegExp) => screen.getByRole('article', { name });

describe('Decisions: phases and actions', () => {
  it('offers Sign only on open and early decisions the admin has not signed', async () => {
    await openPage('admin');
    // Open, not signed: Sign.
    expect(
      within(card(/bob\+builder/)).getByRole('button', { name: /^Sign: / })
    ).toBeInTheDocument();
    // Signed already (7 of 8, close to the end): Signed ✓, no Sign.
    const urgent = await screen.findByRole('article', { name: /Uma Urgent/ });
    expect(within(urgent).getByText('Signed ✓')).toBeInTheDocument();
    expect(within(urgent).queryByRole('button', { name: /^Sign/ })).toBeNull();
    // Enough signatures: applies next block, no Sign.
    const met = await screen.findByRole('article', { name: /Mia Met/ });
    expect(within(met).getByText(/Core applies it in the next block/)).toBeInTheDocument();
    expect(within(met).queryByRole('button', { name: /^Sign/ })).toBeNull();
    // Too late: listed apart, no Sign.
    const late = await screen.findByRole('article', { name: /Lars Late/ });
    expect(
      within(late).getByText(/last block a signature could count in has passed/)
    ).toBeVisible();
    expect(within(late).queryByRole('button', { name: /^Sign/ })).toBeNull();
    // Still unconfirmed: no clock, no Sign.
    const unconfirmed = card(/Remove a Minter Admin/);
    expect(within(unconfirmed).getByText(/On its way into a block/)).toBeInTheDocument();
    expect(within(unconfirmed).queryByRole('button', { name: /^Sign/ })).toBeNull();
    // Early, created and signed by this admin.
    const early = await screen.findByRole('article', { name: /Eli Early/ });
    expect(within(early).getByText('Signed ✓')).toBeInTheDocument();
    // Six decisions are open and unsigned by this admin.
    expect(screen.getAllByRole('button', { name: /^Sign: / })).toHaveLength(6);
    expect(screen.getByText('6 decisions waiting for your signature')).toBeInTheDocument();
  });

  it('shows Sign on an early decision to an admin who has not signed it', async () => {
    await openPage('adminL4');
    const early = await screen.findByRole('article', { name: /Eli Early/ });
    expect(within(early).getByRole('button', { name: /^Sign: / })).toBeInTheDocument();
    expect(within(early).getByText(/Just proposed. Signatures count already/)).toBeInTheDocument();
  });

  it('describes every kind in plain words: reason, ban length, a cancel without a subject', async () => {
    await openPage('admin');
    const kick = await screen.findByRole('article', { name: /Remove from MINTER, Kai Target/ });
    expect(within(kick).getByText('Not minting for 6 months')).toBeInTheDocument();
    const ban = await screen.findByRole('article', { name: /Ban from MINTER, Ben Target/ });
    expect(within(ban).getByText('Permanent')).toBeInTheDocument();
    const cancel = card(/^Cancel an approved invite$/);
    expect(within(cancel).getByText(/Core doesn’t say for whom/)).toBeInTheDocument();
    // Ring, countdown and signers on an open invite.
    const signing = card(/bob\+builder/);
    expect(
      within(signing).getByRole('img', { name: '5 of 8 signatures, 1 confirming' })
    ).toBeInTheDocument();
    expect(within(signing).getByText('left to sign')).toBeInTheDocument();
    expect(within(signing).getByText(/^Expires at block/)).toBeInTheDocument();
    expect(within(signing).getByRole('list', { name: 'Signed by 5 Minter Admins' })).toBeVisible();
    expect(within(signing).getByText(/Confirming: 1 signature on the way/)).toBeInTheDocument();
    // The nomination behind it.
    expect(within(signing).getByText(/Nominated by/)).toBeInTheDocument();
    expect(within(signing).getByText(/Has accepted/)).toBeInTheDocument();
  });

  it('is read-only for people who are not Minter Admins', async () => {
    await openPage('nominator');
    expect(screen.getByText(/Only Minter Admins sign decisions/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sign/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Propose' })).toBeNull();
    expect(screen.queryByRole('button', { name: /First signature/ })).toBeNull();
    expect(screen.queryByText('Unusual approval route')).toBeNull();
    expect(screen.queryByText('Clean up stale invites')).toBeNull();
    expect(screen.queryByText('Hide what I signed')).toBeNull();
    // The waiting nomination is still listed.
    expect(await screen.findByText('Wren Waiting')).toBeInTheDocument();
  });
});

describe('Decisions: signing', () => {
  it('explains the Hub dialog, then signs the pending signature, then shows confirming', async () => {
    const u = user();
    const { world } = await openPage('admin');
    const pending = world.pending.find(
      (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
    ).signature as string;
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'A1' }));

    await u.click(within(card(/bob\+builder/)).getByRole('button', { name: /^Sign: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign this decision' });
    expect(within(dialog).getByText(pending.slice(0, 8))).toBeInTheDocument();
    expect(within(dialog).getAllByText(/GROUP_APPROVAL/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);

    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Signed')).toBeInTheDocument();
    const call = qortalCallsFor('SIGN_TRANSACTION')[0];
    expect(call.process).toBe(true);
    const bytes = base58Decode(String(call.unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(pending);
    expect(bytes[176]).toBe(1);

    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    // The page is aria-hidden until the dialog has closed.
    const signed = await screen.findByRole('article', { name: /bob\+builder/ });
    expect(await within(signed).findByText('Signed ✓ (confirming…)')).toBeInTheDocument();
    expect(within(signed).queryByRole('button', { name: /^Sign: / })).toBeNull();
  });

  it('says so when Hub was cancelled, and nothing was sent', async () => {
    const u = user();
    await openPage('admin');
    await u.click(within(card(/bob\+builder/)).getByRole('button', { name: /^Sign: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign this decision' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/Cancelled in Hub. Nothing was sent./)).toBeVisible();
  });
});

describe('Decisions: navigation and filters', () => {
  it('scrolls to and focuses the decision named in ?d=', async () => {
    const sig = createWorld().pending.find((t: { type: string }) => t.type === 'GROUP_KICK')
      .signature as string;
    await renderPage(<DecisionsPage />, {
      persona: 'admin',
      path: `/decisions?d=${encodeURIComponent(sig)}`,
      route: '/decisions',
    });
    const kick = await screen.findByRole('article', { name: /Remove from MINTER, Kai Target/ });
    await vi.waitFor(() => expect(document.activeElement).toBe(kick));
  });

  it('says when the decision in ?d= is no longer waiting', async () => {
    await openPage('admin', '/decisions?d=gone');
    expect(await screen.findByText(/That decision isn’t waiting any more/)).toBeVisible();
  });

  it('hides what I signed when asked', async () => {
    const u = user();
    await openPage('admin');
    expect(await screen.findByRole('article', { name: /Uma Urgent/ })).toBeInTheDocument();
    await u.click(screen.getByRole('switch', { name: 'Hide what I signed' }));
    expect(screen.queryByRole('article', { name: /Uma Urgent/ })).toBeNull();
    expect(screen.getByText(/2 decisions you signed are hidden/)).toBeVisible();
    await u.click(screen.getByRole('button', { name: 'Show the ones I signed' }));
    expect(await screen.findByRole('article', { name: /Uma Urgent/ })).toBeInTheDocument();
  });

  it('shows the empty state when nothing is waiting', async () => {
    const u = user();
    const { world } = await openPage('admin');
    world.pending.length = 0;
    world.records.length = 0;
    await u.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Nothing waiting for signatures')).toBeVisible();
  });
});
