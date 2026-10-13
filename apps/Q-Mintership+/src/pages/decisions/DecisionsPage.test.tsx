import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { ADDR, addOtherPending } from '../../test/world';
import { createWorld } from '../../../e2e/world.mjs';
import { mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { base58Decode, base58Encode } from '../../qortal/base58';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();

async function openPage(
  persona = 'admin',
  path = '/decisions',
  setup?: RenderPageOptions['setup']
) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona,
    path,
    route: '/decisions',
    setup,
  });
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

  it('describes every kind in plain words: reason, ban length, whose invite is cancelled', async () => {
    await openPage('admin');
    const kick = await screen.findByRole('article', { name: /Remove from MINTER, Kai Target/ });
    expect(within(kick).getByText('Not minting for 6 months')).toBeInTheDocument();
    const ban = await screen.findByRole('article', { name: /Ban from MINTER, Ben Target/ });
    expect(within(ban).getByText('Permanent')).toBeInTheDocument();
    const cancel = card(/^Cancel an approved invite, QgFT6i…1cnG/);
    expect(
      within(cancel).getByRole('link', { name: /QgFT6i…1cnG: open their page/ })
    ).toBeVisible();
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
    // Decisions isn't in their navigation, so the page offers Back.
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('has no Back for Minter Admins, whose navigation has Decisions', async () => {
    await openPage('admin');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});

describe('Decisions: unusual approval route', () => {
  it('shows the unusual approval route to Minter Admins only, with the neutral label', async () => {
    await openPage('admin');
    const list = await screen.findByRole('list', { name: 'Unusual approval route' });
    expect(
      within(list).getByText(
        'This one can’t be signed here. Check it with the other Minter Admins.'
      )
    ).toBeInTheDocument();
    expect(within(list).queryByRole('button')).toBeNull();
  });
});

describe('Decisions: the nomination behind an invite', () => {
  it('never calls an invite record-less when the nominations could not be read', async () => {
    await openPage('admin', '/decisions', () =>
      mockFetchRoute(
        '/arbitrary/resources/searchsimple',
        () => new Response('down', { status: 500 })
      )
    );
    // Mia Met's invite has no record; with the nominations unread, the card says so plainly.
    const met = await screen.findByRole('article', { name: /Mia Met/ });
    expect(
      await within(met).findByText('Couldn’t load the nomination behind this invite.')
    ).toBeVisible();
    expect(within(met).getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.queryByText(/without a nomination record/)).toBeNull();
  });

  it('says an invite has no record once the nominations are in', async () => {
    await openPage('admin');
    const met = await screen.findByRole('article', { name: /Mia Met/ });
    expect(
      await within(met).findByText('Proposed directly on chain, without a nomination record.')
    ).toBeVisible();
  });
});

describe('Decisions: other transactions waiting for Minter Admins', () => {
  it('lists them apart for Minter Admins, read-only, and keeps them out of the queue', async () => {
    await openPage('admin', '/decisions', addOtherPending);
    const list = await screen.findByRole('list', {
      name: 'Other transactions waiting for Minter Admins',
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText(/Invite to a group · group 4242/)).toBeInTheDocument();
    expect(within(list).getByText(/Register name/)).toBeInTheDocument();
    expect(within(list).queryByRole('button')).toBeNull();
    // Nothing in the queue is about them: still six to sign.
    expect(screen.getAllByRole('button', { name: /^Sign: / })).toHaveLength(6);
  });

  it('is not shown to members', async () => {
    await openPage('nominator', '/decisions', addOtherPending);
    expect(
      screen.queryByRole('list', { name: 'Other transactions waiting for Minter Admins' })
    ).toBeNull();
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

describe('Decisions: first signature', () => {
  it('makes the first signature in one guided step of two Hub confirmations', async () => {
    const u = user();
    const { world, address, publicKey } = await openPage('admin');
    const inviteSig = base58Encode(new Uint8Array(64).fill(7));
    mockQortalRequest('INVITE_TO_GROUP', (req: Record<string, unknown>) => {
      const tx = {
        type: 'GROUP_INVITE',
        timestamp: Date.now(),
        signature: inviteSig,
        txGroupId: 694,
        groupId: 694,
        approvalStatus: 'PENDING',
        creatorAddress: address,
        adminPublicKey: publicKey,
        invitee: req.inviteeAddress,
        timeToLive: 864000,
      };
      world.pending.push(tx);
      return tx;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'A2' }));

    await u.click(await screen.findByRole('button', { name: 'First signature: Wren Waiting' }));
    const dialog = await screen.findByRole('dialog', { name: 'First signature: Wren Waiting' });
    expect(within(dialog).getByText('Step 1 of 2: Create the nomination on chain')).toBeVisible();
    expect(within(dialog).getByText('Step 2 of 2: Sign it')).toBeVisible();
    expect(within(dialog).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    expect(qortalCallsFor('INVITE_TO_GROUP')).toHaveLength(0);

    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Signed: the clock has started')).toBeVisible();
    expect(qortalCallsFor('INVITE_TO_GROUP')[0]).toMatchObject({
      inviteeAddress: ADDR.nominatedWaiting,
      groupId: 694,
      txGroupId: 694,
    });
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(inviteSig);
  });

  it('explains a first signature whose second step was cancelled', async () => {
    const u = user();
    const { world } = await openPage('admin');
    const inviteSig = base58Encode(new Uint8Array(64).fill(8));
    mockQortalRequest('INVITE_TO_GROUP', (req: Record<string, unknown>) => {
      const tx = {
        type: 'GROUP_INVITE',
        timestamp: Date.now(),
        signature: inviteSig,
        txGroupId: 694,
        groupId: 694,
        approvalStatus: 'PENDING',
        invitee: req.inviteeAddress,
      };
      world.pending.push(tx);
      return tx;
    });
    // SIGN_TRANSACTION keeps the world's answer: declined.
    await u.click(await screen.findByRole('button', { name: 'First signature: Wren Waiting' }));
    const dialog = await screen.findByRole('dialog', { name: 'First signature: Wren Waiting' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText('Step 1 done: the nomination is on chain')
    ).toBeVisible();
    expect(within(dialog).getByText(/You cancelled step 2 in Hub/)).toBeVisible();
    expect(within(dialog).getByText(/sign it there like any other decision/)).toBeVisible();
  });
});

describe('Decisions: bulk sign', () => {
  it('signs the selected decisions one after another and stops at a cancel', async () => {
    const u = user();
    await openPage('admin');
    let calls = 0;
    mockQortalRequest('SIGN_TRANSACTION', () => {
      calls++;
      if (calls === 2) throw { error: 'User declined request', message: 'User declined request' };
      return { type: 'GROUP_APPROVAL', signature: `S${calls}` };
    });

    await u.click(screen.getByRole('button', { name: 'Sign several' }));
    await u.click(screen.getByRole('checkbox', { name: /bob\+builder/ }));
    await u.click(screen.getByRole('checkbox', { name: /Kai Target/ }));
    await u.click(screen.getByRole('checkbox', { name: /Ben Target/ }));
    expect(screen.getByText('3 of 6 selected')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Sign 3' }));

    const dialog = await screen.findByRole('dialog', { name: 'Sign several' });
    expect(within(dialog).getByText(/3 Hub confirmations, one for each/)).toBeVisible();
    expect(within(dialog).getByText(/Fees in total: 0.03 QORT/)).toBeInTheDocument();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));

    expect(await within(dialog).findByText(/1 of 3 sent/)).toBeVisible();
    const progress = within(dialog).getByRole('list', { name: 'Progress' });
    const items = within(progress).getAllByRole('listitem');
    expect(within(items[0]).getByText('Sent ✓')).toBeVisible();
    expect(within(items[1]).getByText('Cancelled in Hub. Stopped here.')).toBeVisible();
    expect(within(items[2]).getByText('Not sent.')).toBeVisible();
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(2);
  });
});

describe('Decisions: stale invites', () => {
  it('lists approved invites of non-members only, marks recent ones and waiting cancellations', async () => {
    const u = user();
    await openPage('admin');
    expect(await screen.findByText('4 approved invites never used')).toBeVisible();
    expect(screen.getByText(/Left out: 1 invite for people already in MINTER/)).toBeVisible();
    expect(
      screen.getByText('1 of them already has a cancellation waiting for signatures.')
    ).toBeVisible();

    await u.click(screen.getByRole('button', { name: 'Show them' }));
    const list = await screen.findByRole('list', { name: 'Approved invites never used' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(list).queryByText(/Member 6/)).toBeNull();
    const ada = await within(list).findByText('Ada Approved');
    expect(
      within(ada.closest('li') as HTMLElement).getByText(
        /Approved recently: they may still press Join/
      )
    ).toBeVisible();
    // The one whose cancellation is already waiting can't be proposed again.
    const waiting = within(list).getByText('Cancellation waiting for signatures').closest('li')!;
    expect(within(waiting as HTMLElement).queryByRole('button')).toBeNull();
    // Only the two older ones without a waiting cancellation go into "for all".
    expect(
      await screen.findByRole('button', { name: 'Propose cancelling all 2 older ones' })
    ).toBeVisible();
  });
});

describe('Decisions: proposing', () => {
  it('offers removing the admin role first when the member to remove is a Minter Admin', async () => {
    const u = user();
    await openPage('admin');
    mockQortalRequest('REMOVE_GROUP_ADMIN', (req: Record<string, unknown>) => ({
      type: 'REMOVE_GROUP_ADMIN',
      signature: base58Encode(new Uint8Array(64).fill(3)),
      admin: req.qortalAddress,
    }));

    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /Remove a member/ }));
    const form = await screen.findByRole('dialog', { name: 'Remove a member' });
    await u.type(within(form).getByRole('textbox', { name: 'Name or address' }), 'Admin B');
    await u.click(within(form).getByRole('button', { name: 'Find' }));
    expect(await within(form).findByText(/This is a Minter Admin/)).toBeVisible();
    expect(within(form).getByRole('button', { name: 'Review' })).toBeDisabled();

    await u.click(within(form).getByRole('button', { name: 'Propose removing their admin role' }));
    const switched = await screen.findByRole('dialog', { name: 'Remove a Minter Admin' });
    expect(await within(switched).findByText('Nothing stops this proposal.')).toBeVisible();
    await u.click(within(switched).getByRole('button', { name: 'Review' }));

    const hub = await screen.findByRole('dialog', { name: /Remove a Minter Admin: Admin B/ });
    expect(within(hub).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Proposed')).toBeVisible();
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')[0]).toMatchObject({
      groupId: 694,
      txGroupId: 694,
    });
    expect(qortalCallsFor('KICK_FROM_GROUP')).toHaveLength(0);
  });

  it('goes back to the form, with everything typed, from the Hub step or after a cancel in Hub', async () => {
    const u = user();
    await openPage('admin');
    // One dialog closes as the other opens: wait until only `name` is left.
    const only = async (name: string | RegExp) => {
      await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
      return screen.getByRole('dialog', { name });
    };
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /Ban an account/ }));
    let form = await screen.findByRole('dialog', { name: 'Ban an account' });
    await u.type(within(form).getByRole('textbox', { name: 'Name or address' }), 'Leo Learner');
    await u.click(within(form).getByRole('button', { name: 'Find' }));
    expect(await within(form).findByText('Nothing stops this proposal.')).toBeVisible();
    await u.type(within(form).getByRole('textbox', { name: 'Reason' }), 'Spam in the chat');
    await u.click(within(form).getByRole('radio', { name: /A number of days/ }));
    await u.click(within(form).getByRole('button', { name: 'Review' }));

    await screen.findByRole('dialog', { name: /Ban from MINTER: Leo Learner/ });
    let hub = await only(/Ban from MINTER: Leo Learner/);
    await u.click(within(hub).getByRole('button', { name: 'Back to the form' }));
    await screen.findByRole('dialog', { name: 'Ban an account' });
    form = await only('Ban an account');
    expect(within(form).getByRole('textbox', { name: 'Reason' })).toHaveValue('Spam in the chat');
    expect(within(form).getByRole('radio', { name: /A number of days/ })).toBeChecked();

    // The mock world declines every write, as a cancel in Hub would.
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    await screen.findByRole('dialog', { name: /Ban from MINTER: Leo Learner/ });
    hub = await only(/Ban from MINTER: Leo Learner/);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Cancelled in Hub. Nothing was sent.')).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Back to the form' }));
    await screen.findByRole('dialog', { name: 'Ban an account' });
    form = await only('Ban an account');
    expect(within(form).getByRole('textbox', { name: 'Reason' })).toHaveValue('Spam in the chat');
    expect(within(form).getByText('Leo Learner')).toBeVisible();
  });

  it('refuses a ban longer than 24 days before Hub is asked', async () => {
    const u = user();
    await openPage('admin');
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /Ban an account/ }));
    const form = await screen.findByRole('dialog', { name: 'Ban an account' });
    await u.type(within(form).getByRole('textbox', { name: 'Name or address' }), 'Leo Learner');
    await u.click(within(form).getByRole('button', { name: 'Find' }));
    expect(await within(form).findByText('Nothing stops this proposal.')).toBeVisible();
    await u.type(within(form).getByRole('textbox', { name: 'Reason' }), 'Spam in the chat');
    await u.click(within(form).getByRole('radio', { name: /A number of days/ }));
    const days = within(form).getByRole('textbox', { name: 'Days' });
    await u.clear(days);
    await u.type(days, '25');
    expect(within(form).getByText(/A ban can last up to 24 days/)).toBeVisible();
    expect(within(form).getByRole('button', { name: 'Review' })).toBeDisabled();
    await u.clear(days);
    await u.type(days, '24');
    expect(within(form).getByRole('button', { name: 'Review' })).toBeEnabled();
    // Core counts a ban from its proposal, so the form says so.
    expect(
      within(form).getByText(/^24 days, counted from when it is proposed, not from approval/)
    ).toBeVisible();
    await u.click(within(form).getByRole('button', { name: 'Review' }));
    const hub = await screen.findByRole('dialog', { name: /Ban from MINTER: Leo Learner/ });
    expect(
      within(hub).getByText(/24 days, counted from when it is proposed, not from approval/)
    ).toBeInTheDocument();
    expect(qortalCallsFor('BAN_FROM_GROUP')).toHaveLength(0);
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
