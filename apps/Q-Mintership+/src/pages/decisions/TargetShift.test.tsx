import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { ADDR, addTargetShift, type World } from '../../../e2e/world.mjs';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { base58Decode, base58Encode } from '../../qortal/base58';
import { proposePath } from '../../routes/paths';
import DecisionsPage from './DecisionsPage';
import ProposePage from './propose/ProposePage';
import { SUBMIT_LABEL } from './propose/proposePageWords';

// The heaviest page tests: each flow renders the whole Decisions page several times
// over. Alone they take 2–7 s; with the full suite on every core some pass 15 s.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

type Shift = ReturnType<typeof addTargetShift>;

/** Decisions in the moving-target world (21 admin rows, 9 needed). */
async function openShifted(
  options: { persona?: string; more?: (world: World, shift: Shift) => void } = {}
) {
  let shift: Shift | null = null;
  const setup: RenderPageOptions['setup'] = (world) => {
    shift = addTargetShift(world);
    options.more?.(world, shift);
  };
  const rendered = await renderPage(<DecisionsPage />, {
    persona: options.persona ?? 'admin',
    path: '/decisions?show=decisions',
    route: '/decisions',
    setup,
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return { ...rendered, shift: shift as unknown as Shift };
}

const card = (name: RegExp) => screen.getByRole('article', { name });

describe('Decisions: an admin change says what it does to the target', () => {
  it('on its card: the new target, and the decisions that would apply at once', async () => {
    await openShifted();
    const removal = card(/^Remove a Minter Admin, Dex Demote/);
    const note = within(removal).getByRole('note');
    expect(note).toHaveTextContent(
      'If this passes, MINTER has 20 admin seats and the target drops from 9 to 8 approvals.'
    );
    expect(
      within(note).getByText(
        'These would apply at once, in the same block or the next, with no new approval:'
      )
    ).toBeVisible();
    expect(within(note).getByText('Add to MINTER: Mia Met (8 of 9)')).toBeVisible();
    // What admins can do about it: the order, and withdrawing a signature.
    expect(within(note).getByText(/agree the order with the other Minter Admins/)).toBeVisible();
    expect(
      within(note).getByText(/You can still reject it before.+costs 0\.01 QORT\./)
    ).toBeVisible();
  });

  it('a change that leaves the target where it is says so', async () => {
    await openPage();
    const removal = card(/^Remove a Minter Admin, Dex Demote/);
    expect(within(removal).getByRole('note')).toHaveTextContent(
      'If this passes, MINTER has 19 admin seats; the target stays at 8 approvals. No waiting decision would change because of it.'
    );
  });

  it('a new admin raises the target: what has enough approvals now would fall short', async () => {
    await openPage();
    const add = card(/^(Make|Become) a Minter Admin, Pia Promote/);
    const note = within(add).getByRole('note');
    expect(note).toHaveTextContent(
      'If this passes, MINTER has 21 admin seats and the target rises from 8 to 9 approvals.'
    );
    expect(
      within(note).getByText('Add to MINTER: Mia Met (8 of 8: enough now, 1 short then)')
    ).toBeVisible();
    expect(note).toHaveTextContent(
      /The other \d+ decisions still collecting would each need 1 more approval than now\./
    );
    // Mia Met's card: the chip says the target may rise.
    const met = card(/^Add to MINTER, Mia Met/);
    expect(within(met).getByRole('button', { name: 'Target may rise to 9' })).toBeVisible();
  });
});

describe('Decisions: an admin change about to apply', () => {
  it('says above the queue what it will tip over when it applies', async () => {
    await openShifted({
      // Dex Demote's removal gets the kick's nine signers too: enough signatures.
      more: (world, shift) => {
        const signers = world.approvals.filter(
          (a: { pendingSignature: string }) => a.pendingSignature === shift.kick
        );
        for (const a of signers)
          world.approvals.push({
            ...a,
            pendingSignature: shift.demote,
            signature: `${a.signature.slice(0, -3)}zzz`,
          });
      },
    });
    const section = screen.getByRole('region', { name: 'Admin changes and the target' });
    const note = within(section).getByRole('note');
    expect(note).toHaveTextContent(
      'Remove a Minter Admin: Dex Demote has enough approvals: Core applies it in the next block. When it does, MINTER has 20 admin seats and the target drops from 9 to 8 approvals.'
    );
    expect(within(note).getByText('Add to MINTER: Mia Met (8 of 9)')).toBeVisible();
    // It applies in the next block: a withdrawal sent now would land too late to count.
    expect(within(note).getByText(/agree the order with the other Minter Admins/)).toBeVisible();
    expect(note).not.toHaveTextContent(/withdraw your signature/);
  });

  it('is not there when no admin change is about to tip anything over', async () => {
    await openShifted();
    expect(screen.queryByRole('region', { name: 'Admin changes and the target' })).toBeNull();
  });
});

describe('Decisions: the chip on a decision an admin change would tip over', () => {
  it('says where the target may go, and explains it one tap away', async () => {
    const u = user();
    await openShifted({
      // One of Mia Met's eight signatures is this admin's: Withdraw is on the card.
      more: (world, shift) => {
        const mine = world.approvals.find(
          (a: { pendingSignature: string }) => a.pendingSignature === shift.met
        );
        mine.creatorAddress = ADDR.admin;
        mine.adminPublicKey = world.accounts.get(ADDR.admin).publicKey;
      },
    });
    const met = card(/^Add to MINTER, Mia Met/);
    expect(within(met).getByRole('button', { name: /^Reject: / })).toBeVisible();
    const chip = within(met).getByRole('button', { name: 'Target may drop to 8' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(within(met).queryByText(/Core would apply it at once/)).toBeNull();

    await u.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    const id = chip.getAttribute('aria-controls') as string;
    const note = document.getElementById(id) as HTMLElement;
    expect(note).toHaveTextContent(
      'If Remove a Minter Admin: Dex Demote passes, MINTER has 20 admin seats and the target drops from 9 to 8 approvals.'
    );
    expect(note).toHaveTextContent(
      'This decision has 8 approvals, so Core would apply it at once, in the same block or the next, with no new approval.'
    );
    expect(note).toHaveTextContent(/You can still reject it before the admin change passes/);

    await u.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(id)).toBeNull();
  });

  it('says how to withdraw only to an admin whose signature is on it', async () => {
    const u = user();
    await openShifted();
    const met = card(/^Add to MINTER, Mia Met/);
    expect(within(met).queryByRole('button', { name: /^Withdraw my signature/ })).toBeNull();
    await u.click(within(met).getByRole('button', { name: 'Target may drop to 8' }));
    expect(within(met).getByText(/agree the order with the other Minter Admins/)).toBeVisible();
    expect(within(met).queryByText(/withdraw your signature/)).toBeNull();
  });

  it('members see the chip and the reason, without the advice for admins', async () => {
    const u = user();
    await openShifted({ persona: 'learner' });
    const met = card(/^Add to MINTER, Mia Met/);
    await u.click(within(met).getByRole('button', { name: 'Target may drop to 8' }));
    expect(within(met).getByText(/Core would apply it at once/)).toBeVisible();
    expect(within(met).queryByText(/withdraw your signature/)).toBeNull();
  });

  it('no chip where no admin change would tip it over', async () => {
    await openShifted();
    const urgent = card(/^Add to MINTER, Uma Urgent/);
    expect(within(urgent).queryByRole('button', { name: /^Target may/ })).toBeNull();
  });
});

describe('Decisions: signing an admin change that would tip others over', () => {
  it('needs "I’ve checked these" before Hub opens', async () => {
    const u = user();
    const { shift } = await openShifted();
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'A1' }));
    await u.click(
      within(card(/^Remove a Minter Admin, Dex Demote/)).getByRole('button', { name: /^Approve: / })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Approve this decision' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      /target drops from 9 to 8 approvals.+Add to MINTER: Mia Met \(8 of 9\)/
    );
    const box = within(dialog).getByRole('checkbox', { name: 'I’ve checked these' });
    expect(box).not.toBeChecked();

    // Continue without the tick: Hub isn't asked, the box says why and takes focus.
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Tick “I’ve checked these” to go on.'
    );
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute('aria-invalid', 'true');

    await u.click(box);
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Approved', {}, T)).toBeInTheDocument();
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(shift.demote);
  });

  it('starts unticked again for the next decision', async () => {
    const u = user();
    await openShifted();
    const sign = async () =>
      u.click(
        within(
          await screen.findByRole('article', { name: /^Remove a Minter Admin, Dex Demote/ })
        ).getByRole('button', { name: /^Approve: / })
      );
    await sign();
    let dialog = await screen.findByRole('dialog', { name: 'Approve this decision' });
    await u.click(within(dialog).getByRole('checkbox', { name: 'I’ve checked these' }));
    await u.click(within(dialog).getByRole('button', { name: 'Not now' }));
    await sign();
    dialog = await screen.findByRole('dialog', { name: 'Approve this decision' });
    expect(within(dialog).getByRole('checkbox', { name: 'I’ve checked these' })).not.toBeChecked();
  });

  it('signing a decision that only carries a chip needs no tick', async () => {
    const u = user();
    await openShifted();
    await u.click(
      within(card(/^Add to MINTER, Mia Met/)).getByRole('button', { name: /^Approve: / })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Approve this decision' });
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect(within(dialog).queryByRole('note')).toBeNull();
  });

  it('Approve several with an admin change in it needs the same tick', async () => {
    const u = user();
    await openShifted();
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'B1' }));
    await u.click(screen.getByRole('button', { name: 'Approve several' }));
    await u.click(screen.getByRole('checkbox', { name: /Dex Demote/ }));
    await u.click(screen.getByRole('checkbox', { name: /Ben Target/ }));
    await u.click(screen.getByRole('button', { name: 'Approve 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve several' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      /^If Remove a Minter Admin: Dex Demote passes, MINTER has 20 admin seats and the target drops from 9 to 8 approvals\./
    );
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
    expect(within(dialog).getByRole('checkbox', { name: 'I’ve checked these' })).toHaveFocus();
    await u.click(within(dialog).getByRole('checkbox', { name: 'I’ve checked these' }));
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/2 of 2 sent/, {}, T)).toBeVisible();
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(2);
  });
});

describe('+ Propose: an admin change', () => {
  it('says what it would do to the target before Hub opens, and needs the tick', async () => {
    const u = user();
    await renderPage(<ProposePage />, {
      persona: 'admin',
      path: proposePath('removeAdmin'),
      route: '/propose/:kind',
      setup: (world) => void addTargetShift(world),
    });
    const next = await screen.findByRole('region', { name: 'What happens next' }, T);
    expect(within(next).getByText(/this can move the target for all of them/)).toBeVisible();
    const admins = await screen.findByRole('list', { name: 'Minter Admins' }, T);
    await u.click(
      await within(admins).findByRole('button', { name: 'Remove Admin B as Minter Admin' }, T)
    );
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.click(screen.getByRole('button', { name: SUBMIT_LABEL.removeAdmin.named('Admin B') }));

    const hub = await screen.findByRole('dialog', { name: /Remove a Minter Admin: Admin B/ });
    const note = within(hub).getByRole('note');
    expect(note).toHaveTextContent(
      'If this passes, MINTER has 20 admin seats and the target drops from 9 to 8 approvals.'
    );
    expect(within(note).getByText('Add to MINTER: Mia Met (8 of 9)')).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(0);
    expect(within(hub).getByRole('checkbox', { name: 'I’ve checked these' })).toHaveFocus();
    await u.click(within(hub).getByRole('checkbox', { name: 'I’ve checked these' }));
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText(/Cancelled in Hub/, {}, T)).toBeVisible();
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(1);
  }, 20_000);
});

describe('Decisions: how signing works', () => {
  it('says admin changes move the target, and to plan the order', async () => {
    const u = user();
    await openPage();
    await u.click(screen.getByRole('button', { name: 'How approving works' }));
    expect(
      screen.getByText(/^Adding or removing a Minter Admin moves the target for every waiting/)
    ).toBeVisible();
    expect(
      screen.getByText(/^So before approving an admin change, look at what it would tip over/)
    ).toBeVisible();
  });
});

async function openPage() {
  await renderPage(<DecisionsPage />, {
    persona: 'admin',
    path: '/decisions?show=decisions',
    route: '/decisions',
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
}
