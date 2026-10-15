import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { ADDR } from '../../test/world';
import { addConsidering, addDoubles } from '../../../e2e/world.mjs';
import { base58Encode } from '../../qortal/base58';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import HomePage from '../home/HomePage';
import PersonPage from '../person/PersonPage';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

async function openDecisions(persona = 'admin', setup?: RenderPageOptions['setup']) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona,
    path: '/decisions',
    route: '/decisions',
    setup,
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return rendered;
}

describe('Considering on the Decisions page', () => {
  it('shows who is considering in its own column, with notes, to everyone', async () => {
    await openDecisions('learner', (world) => addConsidering(world));
    const card = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    const column = await within(card).findByRole('list', { name: /^Considering: / }, T);
    expect(column).toHaveAccessibleName('Considering: 2 Minter Admins');
    // (Each name follows its avatar's letter.)
    expect(column).toHaveTextContent(
      /^A?Admin K“Waiting to hear back from them in Q-Chat about their node\.”A?Admin L$/
    );
    expect(within(column).getByRole('link', { name: 'Admin K: open their page' })).toBeVisible();
    // Not the admin who cleared theirs, nor the one who approved since, nor a member.
    expect(column).not.toHaveTextContent('Admin N');
    expect(column).not.toHaveTextContent('Admin B');
    expect(column).not.toHaveTextContent('Nora');
    // The waiting nomination shows the count.
    expect(await screen.findByText('1 Minter Admin is considering', {}, T)).toBeVisible();
    // Members can't mark anything.
    expect(screen.queryByRole('button', { name: /^Considering: / })).toBeNull();
    // One search for all the cards, paged at 100.
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('qmp-considering-')
    );
    expect(new Set(searches).size).toBe(1);
    expect(searches.every((p) => /limit=100/.test(p))).toBe(true);
  });

  it('an admin marks a decision as considering: the fee first, then Considering (publishing…)', async () => {
    const u = user();
    const { world } = await openDecisions('admin');
    const pending = world.pending.find(
      (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
    ).signature as string;
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'C1' }));
    const card = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    await u.click(within(card).getByRole('button', { name: /^Considering: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as considering' });
    expect(within(dialog).getByText(/It changes nothing on chain/)).toBeVisible();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    await u.type(within(dialog).getByRole('textbox', { name: 'A note (optional)' }), 'Soon.');
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Marked as considering', {}, T)).toBeInTheDocument();
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call.identifier).toBe(`qmp-considering-${pending.slice(0, 40)}`);
    expect(JSON.parse(atob(String(call.data64)))).toEqual({
      v: 1,
      pendingSignature: pending,
      note: 'Soon.',
    });
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    const after = await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
    expect(await within(after).findByText('Considering (publishing…)')).toBeInTheDocument();
    expect(within(after).getByRole('button', { name: /^No longer considering: / })).toBeDisabled();
  }, 20_000);

  it('an admin who is considering can say they no longer are', async () => {
    const u = user();
    await openDecisions('admin', (world) => {
      const invite = world.pending.find(
        (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
      );
      world.records.push({
        name: 'Avery Admin',
        identifier: `qmp-considering-${invite.signature.slice(0, 40)}`,
        created: Date.now() - 60_000,
        body: { v: 1, pendingSignature: invite.signature },
      });
    });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'C2' }));
    const card = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    expect(
      await within(card).findByRole('list', { name: 'Considering: 1 Minter Admin' }, T)
    ).toHaveTextContent('Avery Admin');
    expect(within(card).getAllByText('Considering')).toHaveLength(2);
    await u.click(within(card).getByRole('button', { name: /^No longer considering: / }));
    const dialog = await screen.findByRole('dialog', { name: 'No longer considering' });
    expect(within(dialog).getByText(/QDN can’t delete a record/)).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Updated', {}, T)).toBeInTheDocument();
    expect(
      JSON.parse(atob(String(qortalCallsFor('PUBLISH_QDN_RESOURCE')[0].data64)))
    ).toMatchObject({
      cleared: true,
    });
  }, 20_000);

  it('keeps a note to its own decision: another one starts empty', async () => {
    const u = user();
    await openDecisions('admin');
    const card = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    const open = async (button: HTMLElement) => {
      await u.click(button);
      const dialog = await screen.findByRole('dialog', { name: 'Mark as considering' });
      return within(dialog);
    };
    let dialog = await open(within(card).getByRole('button', { name: /^Considering: / }));
    await u.type(dialog.getByRole('textbox', { name: 'A note (optional)' }), 'Asking their node.');
    await u.click(dialog.getByRole('button', { name: 'Not now' }));
    // The same decision again: the draft is still there.
    dialog = await open(await within(card).findByRole('button', { name: /^Considering: / }, T));
    expect(dialog.getByRole('textbox', { name: 'A note (optional)' })).toHaveValue(
      'Asking their node.'
    );
    await u.click(dialog.getByRole('button', { name: 'Not now' }));
    // Another decision: an empty note, never the first one's.
    const other = (await screen.findAllByRole('button', { name: /^Considering: / }, T)).find(
      (b) => !card.contains(b)
    ) as HTMLElement;
    dialog = await open(other);
    expect(dialog.getByRole('textbox', { name: 'A note (optional)' })).toHaveValue('');
  }, 20_000);

  it('mentions the nominee only where there is one', async () => {
    const u = user();
    await openDecisions('admin');
    const invite = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    await u.click(within(invite).getByRole('button', { name: /^Considering: / }));
    let dialog = await screen.findByRole('dialog', { name: 'Mark as considering' });
    expect(dialog).toHaveTextContent(/Tell the other Minter Admins, and the nominee, that/);
    await u.click(within(dialog).getByRole('button', { name: 'Not now' }));
    const kick = await screen.findByRole('article', { name: /^Remove from MINTER, Kai Target/ });
    await u.click(await within(kick).findByRole('button', { name: /^Considering: / }, T));
    dialog = await screen.findByRole('dialog', { name: 'Mark as considering' });
    expect(dialog).toHaveTextContent(/Tell the other Minter Admins that you’ve looked at this/);
    expect(dialog).not.toHaveTextContent(/nominee/);
  }, 20_000);

  it('offers Considering on a nomination waiting for its first approval', async () => {
    await openDecisions('admin');
    expect(
      await screen.findByRole('button', { name: 'Considering: Nomination of Wren Waiting' }, T)
    ).toBeVisible();
  });
});

describe('Considering again after a rejection', () => {
  type World = Parameters<NonNullable<RenderPageOptions['setup']>>[0];
  const KICK = /^Remove from MINTER, Kai Target/;
  /** Avery Admin's answer on the kick, `after` ms after it was proposed (in a block, or on its way). */
  const answerKick = (world: World, approval: boolean, after: number, confirmed = true) => {
    const kick = world.pending.find((t: { type: string }) => t.type === 'GROUP_KICK');
    (confirmed ? world.approvals : world.unconfirmedApprovals).push({
      type: 'GROUP_APPROVAL',
      timestamp: kick.timestamp + after,
      signature: base58Encode(new Uint8Array(64).fill(50 + after / 60_000)),
      txGroupId: 0,
      ...(confirmed ? { blockHeight: kick.blockHeight + 2 + after / 60_000 } : {}),
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: ADDR.admin,
      adminPublicKey: world.accounts.get(ADDR.admin).publicKey,
      pendingSignature: kick.signature,
      approval,
    });
    return kick;
  };
  /** Avery Admin's Considering record on the kick, published `after` ms after it was proposed. */
  const consideringKick = (world: World, after: number) => {
    const kick = world.pending.find((t: { type: string }) => t.type === 'GROUP_KICK');
    world.records.push({
      name: 'Avery Admin',
      identifier: `qmp-considering-${kick.signature.slice(0, 40)}`,
      created: kick.timestamp + after,
      body: { v: 1, pendingSignature: kick.signature, note: 'Looking again.' },
    });
  };

  it('offers Reconsidering to an admin whose rejection is in a block, worded for it', async () => {
    const u = user();
    let pending = '';
    await openDecisions('admin', (world) => {
      pending = answerKick(world, false, 120_000).signature;
    });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'C3' }));
    const kick = screen.getByRole('article', { name: KICK });
    expect(within(kick).getByText('You rejected')).toBeInTheDocument();
    await u.click(
      await within(kick).findByRole(
        'button',
        { name: 'Reconsidering: Remove from MINTER, Kai Target' },
        T
      )
    );
    const dialog = await screen.findByRole('dialog', { name: 'Mark as reconsidering' });
    expect(within(dialog).getByText(/looking at this again after rejecting it/)).toBeVisible();
    expect(
      within(dialog).getByText(/Your rejection still counts until you approve\./)
    ).toBeVisible();
    expect(within(dialog).getByText(/Approving later replaces it/)).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Marked as reconsidering', {}, T)).toBeInTheDocument();
    expect(JSON.parse(atob(String(qortalCallsFor('PUBLISH_QDN_RESOURCE')[0].data64)))).toEqual({
      v: 1,
      pendingSignature: pending,
    });
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    const after = await screen.findByRole('article', { name: KICK });
    expect(await within(after).findByText('Considering (publishing…)')).toBeInTheDocument();
  }, 20_000);

  it('a record from before the rejection stays hidden; one from after shows', async () => {
    await openDecisions('admin', (world) => {
      consideringKick(world, 60_000);
      answerKick(world, false, 120_000);
    });
    let kick = screen.getByRole('article', { name: KICK });
    expect(
      await within(kick).findByRole('button', { name: /^Reconsidering: / }, T)
    ).toBeInTheDocument();
    expect(within(kick).queryByText(/^Considering:/)).toBeNull();
    cleanup();

    await openDecisions('admin', (world) => {
      answerKick(world, false, 120_000);
      consideringKick(world, 180_000);
    });
    kick = screen.getByRole('article', { name: KICK });
    expect(await within(kick).findByRole('list', { name: /^Considering: / }, T)).toHaveTextContent(
      'Avery Admin'
    );
    // The column's heading, and the admin's own chip.
    expect(within(kick).getAllByText('Considering')).toHaveLength(2);
    expect(within(kick).getByRole('button', { name: /^No longer considering: / })).toBeVisible();
    expect(within(kick).getByRole('button', { name: /^Approve: / })).toBeVisible();
  }, 20_000);

  it('a signature after the record hides it again', async () => {
    await openDecisions('admin', (world) => {
      answerKick(world, false, 120_000);
      consideringKick(world, 180_000);
      answerKick(world, true, 240_000);
    });
    const kick = screen.getByRole('article', { name: KICK });
    expect(await within(kick).findByText('You approved ✓', {}, T)).toBeInTheDocument();
    expect(within(kick).queryByText(/^Considering:/)).toBeNull();
    expect(within(kick).queryByRole('button', { name: /^(Re)?[Cc]onsidering: / })).toBeNull();
  });

  it('waits until the rejection is in a block, and is never offered on a double', async () => {
    await openDecisions('admin', (world) => {
      answerKick(world, false, 120_000, false);
      const { alreadyAdmin } = addDoubles(world);
      const double = world.pending.find(
        (t: { signature: string }) => t.signature === alreadyAdmin.signature
      );
      world.approvals.push({
        type: 'GROUP_APPROVAL',
        timestamp: double.timestamp + 60_000,
        signature: base58Encode(new Uint8Array(64).fill(77)),
        txGroupId: 0,
        blockHeight: double.blockHeight + 1,
        approvalStatus: 'NOT_REQUIRED',
        creatorAddress: ADDR.admin,
        adminPublicKey: world.accounts.get(ADDR.admin).publicKey,
        pendingSignature: double.signature,
        approval: false,
      });
    });
    const kick = screen.getByRole('article', { name: KICK });
    expect(within(kick).getByText('You rejected (confirming…)')).toBeInTheDocument();
    const double = screen.getByRole('article', { name: 'Become a Minter Admin, Admin C' });
    expect(within(double).getByText('You rejected')).toBeInTheDocument();
    // Considering is offered elsewhere, so the shared read is in.
    await screen.findAllByRole('button', { name: /^Considering: / }, T);
    expect(within(kick).queryByRole('button', { name: /^(Re)?[Cc]onsidering: / })).toBeNull();
    expect(within(double).queryByRole('button', { name: /^(Re)?[Cc]onsidering: / })).toBeNull();
  });
});

describe('Considering for the nominee and on person pages', () => {
  it("the nominee's Home says how many Minter Admins are considering", async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => addConsidering(world),
    });
    expect(
      await screen.findByText(/^2 Minter Admins are considering: they’ve looked at it/, {}, T)
    ).toBeVisible();
  });

  it("a person's page shows the count on their nomination", async () => {
    await renderPage(<PersonPage />, {
      persona: 'learner',
      path: `/people/${ADDR.nominatedWaiting}`,
      route: '/people/:address',
      setup: (world) => addConsidering(world),
    });
    expect(await screen.findByText('1 Minter Admin is considering', {}, T)).toBeVisible();
  });
});
