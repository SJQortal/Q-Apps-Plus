/**
 * The note for the Minter Admins on a decision (Simon, 2026-10-18: when
 * Minter Admins create a decision, an extra description encrypted to the
 * Minter Admins only): who sees it on the cards, adding it from Propose as a
 * third Hub step, and adding one later to one's own decision.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addAdminNotes, addComments, fakeAddress, type World } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { serveAdminPolls } from '../../test/adminPolls';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import { base58Encode } from '../../qortal/base58';
import { fromData64 } from '../../data/adminPollRecords';
import { resetPendingAdminNotes } from '../../state/adminNotes';
import DecisionsPage from './DecisionsPage';

vi.setConfig({ testTimeout: 30_000 });
afterEach(() => {
  vi.useRealTimers();
  resetPendingAdminNotes();
});

const T = { timeout: 4000 };

async function openPage(persona: string, more?: (world: World) => void) {
  let notes: ReturnType<typeof addAdminNotes> | null = null;
  const rendered = await renderPage(<DecisionsPage />, {
    persona,
    path: '/decisions?show=decisions',
    route: '/decisions',
    setup: (world) => {
      addComments(world);
      notes = addAdminNotes(world);
      more?.(world);
      serveAdminPolls(world, persona);
    },
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ }, T);
  return { ...rendered, notes: notes as unknown as ReturnType<typeof addAdminNotes> };
}

const card = (name: RegExp) => screen.getByRole('article', { name });

describe('on the cards', () => {
  it('a Minter Admin reads the proposer’s note under the reason, and only the proposer’s', async () => {
    const { notes } = await openPage('admin');
    const kick = card(/Remove from MINTER, Kai Target/);
    expect(await within(kick).findByText(notes.texts.kickNote, {}, T)).toBeVisible();
    expect(within(kick).getByText('For the Minter Admins only')).toBeVisible();
    expect(within(kick).getByText(/^By/).textContent).toContain('Admin E');
    expect(within(kick).queryByText('Not the proposer: this note never shows.')).toBeNull();
    // No Edit on someone else's note.
    expect(within(kick).queryByRole('button', { name: /Edit your note/ })).toBeNull();
    // The invite shows its nominator's note.
    const invite = card(/Add to MINTER, bob\+builder/);
    expect(await within(invite).findByText(notes.texts.nominationNote, {}, T)).toBeVisible();
    // A ban whose proposer wrote none shows nothing.
    expect(
      within(card(/Ban from MINTER, Ben Target/)).queryByText('For the Minter Admins only')
    ).toBeNull();
    // One shared list of notes, not a search per card.
    expect(
      fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
        p.includes('identifier=qmp-adminnote-')
      )
    ).toHaveLength(1);
  });

  it('anyone else sees no note, and nothing encrypted is read for them', async () => {
    const { notes } = await openPage('nominator');
    const kick = card(/Remove from MINTER, Kai Target/);
    await within(kick).findByText(/Not minting for 6 months/, {}, T);
    expect(within(kick).queryByText(notes.texts.kickNote)).toBeNull();
    expect(screen.queryByText('For the Minter Admins only')).toBeNull();
    expect(fetchCallsFor('service=DOCUMENT_PRIVATE')).toEqual([]);
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([]);
  });
});

describe('from Propose', () => {
  it('a note goes as a third Hub step once the proposal and its approval are in, encrypted', async () => {
    const u = userEvent.setup();
    const { world, address, publicKey } = await openPage('admin');
    const kickSig = base58Encode(new Uint8Array(64).fill(5));
    mockQortalRequest('KICK_FROM_GROUP', (req: Record<string, unknown>) => {
      const tx = {
        type: 'GROUP_KICK',
        timestamp: Date.now(),
        reference: base58Encode(new Uint8Array(64).fill(1)),
        signature: kickSig,
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
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'NOTE',
      identifier: r.identifier,
    }));

    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /Remove a member/ }));
    const form = await screen.findByRole('dialog', { name: 'Remove a member' });
    await u.type(within(form).getByRole('textbox', { name: 'Name or address' }), 'Leo Learner');
    await u.click(within(form).getByRole('button', { name: 'Find' }));
    expect(await within(form).findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.type(within(form).getByRole('textbox', { name: 'Reason' }), 'Not minting');
    const noteBox = within(form).getByRole('textbox', {
      name: 'Note for the Minter Admins (optional)',
    });
    expect(
      within(form).getByText(/Encrypted to the 19 Minter Admins: only they can read it\./)
    ).toBeVisible();
    await u.type(noteBox, 'Offline since March; asked twice.');
    await u.click(within(form).getByRole('button', { name: 'Review' }));

    const hub = await screen.findByRole('dialog', { name: /Remove from MINTER: Leo Learner/ }, T);
    expect(
      within(hub).getByText('Step 3 of 3: Add your note for the Minter Admins, encrypted')
    ).toBeVisible();
    expect(within(hub).getByText(/Fees in total: 0.03 QORT/)).toBeInTheDocument();
    expect(within(hub).getByText(/Note for the Minter Admins \(encrypted\):/)).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Proposed and approved', {}, T)).toBeVisible();
    const [note] = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(note).toMatchObject({
      name: 'Avery Admin',
      service: 'DOCUMENT_PRIVATE',
      identifier: `qmp-adminnote-${kickSig.slice(0, 40)}`,
      encrypt: true,
    });
    expect(fromData64(String(note.data64))).toEqual({
      v: 1,
      key: kickSig.slice(0, 40),
      text: 'Offline since March; asked twice.',
    });
  });

  it('with no note, still two steps', async () => {
    const u = userEvent.setup();
    await openPage('admin');
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /Remove a member/ }));
    const form = await screen.findByRole('dialog', { name: 'Remove a member' });
    await u.type(within(form).getByRole('textbox', { name: 'Name or address' }), 'Leo Learner');
    await u.click(within(form).getByRole('button', { name: 'Find' }));
    await within(form).findByText('Nothing stops this proposal.', {}, T);
    await u.type(within(form).getByRole('textbox', { name: 'Reason' }), 'Not minting');
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    const hub = await screen.findByRole('dialog', { name: /Remove from MINTER: Leo Learner/ }, T);
    expect(within(hub).getByText('Step 2 of 2: Approve it')).toBeVisible();
    expect(within(hub).queryByText(/Add your note/)).toBeNull();
  });
});

describe('later, on one’s own decision', () => {
  it('its proposer adds a note while it is open, and it shows at once', async () => {
    const u = userEvent.setup();
    const sig = base58Encode(new Uint8Array(64).fill(6));
    await openPage('admin', (world) => {
      world.pending.push({
        type: 'GROUP_BAN',
        timestamp: Date.now() - 3_600_000,
        reference: base58Encode(new Uint8Array(64).fill(2)),
        signature: sig,
        fee: '0.01000000',
        txGroupId: 694,
        groupId: 694,
        blockHeight: world.pending[0].blockHeight,
        approvalStatus: 'PENDING',
        creatorAddress: ADDR.admin,
        adminPublicKey: world.accounts.get(ADDR.admin).publicKey,
        offender: fakeAddress('ban-me'),
        reason: 'Spam',
        timeToLive: 0,
      });
    });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'NOTE',
      identifier: r.identifier,
    }));
    const add = await screen.findByRole(
      'button',
      { name: /^Add a note for the Minter Admins: Ban/ },
      T
    );
    await u.click(add);
    const dialog = await screen.findByRole('dialog', { name: 'Add a note for the Minter Admins' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    // Nothing written: it says so, and stays.
    expect(within(dialog).getByText('Write something first.')).toBeVisible();
    await u.type(
      within(dialog).getByRole('textbox', { name: 'Note for the Minter Admins' }),
      'Posted the same link 40 times.'
    );
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Note added', {}, T)).toBeVisible();
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')[0]).toMatchObject({
      identifier: `qmp-adminnote-${sig.slice(0, 40)}`,
      encrypt: true,
    });
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByText('Posted the same link 40 times.')).toBeVisible());
    expect(screen.getByText(/publishing…/)).toBeVisible();
  });
});
