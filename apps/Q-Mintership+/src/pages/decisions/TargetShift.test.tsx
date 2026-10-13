import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { addTargetShift } from '../../../e2e/world.mjs';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { base58Decode, base58Encode } from '../../qortal/base58';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

type Shift = ReturnType<typeof addTargetShift>;

/** Decisions in the moving-target world (21 admin rows, 9 needed). */
async function openShifted(options: { persona?: string } = {}) {
  let shift: Shift | null = null;
  const setup: RenderPageOptions['setup'] = (world) => {
    shift = addTargetShift(world);
  };
  const rendered = await renderPage(<DecisionsPage />, {
    persona: options.persona ?? 'admin',
    path: '/decisions',
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
      'If this passes, MINTER has 20 admin seats and the target drops from 9 to 8 signatures.'
    );
    expect(
      within(note).getByText(
        'These would apply at once, in the same block or the next, with no new signature:'
      )
    ).toBeVisible();
    expect(within(note).getByText('Add to MINTER: Mia Met (8 of 9)')).toBeVisible();
    // What admins can do about it: the order, and withdrawing a signature.
    expect(within(note).getByText(/agree the order with the other Minter Admins/)).toBeVisible();
    expect(
      within(note).getByText(/A withdrawal counts as a rejection.+costs 0\.01 QORT\./)
    ).toBeVisible();
  });

  it('a change that leaves the target where it is says so', async () => {
    await openPage();
    const removal = card(/^Remove a Minter Admin, Dex Demote/);
    expect(within(removal).getByRole('note')).toHaveTextContent(
      'If this passes, MINTER has 19 admin seats; the target stays at 8 signatures. No waiting decision would change because of it.'
    );
  });

  it('a new admin raises the target: what has enough signatures now would fall short', async () => {
    await openPage();
    const add = card(/^Make a Minter Admin, Pia Promote/);
    const note = within(add).getByRole('note');
    expect(note).toHaveTextContent(
      'If this passes, MINTER has 21 admin seats and the target rises from 8 to 9 signatures.'
    );
    expect(
      within(note).getByText('Add to MINTER: Mia Met (8 of 8: enough now, 1 short then)')
    ).toBeVisible();
    expect(note).toHaveTextContent(
      /The other \d+ decisions still collecting would each need 1 more signature than now\./
    );
    // Mia Met's card: the chip says the target may rise.
    const met = card(/^Add to MINTER, Mia Met/);
    expect(within(met).getByRole('button', { name: 'Target may rise to 9' })).toBeVisible();
  });
});

describe('Decisions: the chip on a decision an admin change would tip over', () => {
  it('says where the target may go, and explains it one tap away', async () => {
    const u = user();
    await openShifted();
    const met = card(/^Add to MINTER, Mia Met/);
    const chip = within(met).getByRole('button', { name: 'Target may drop to 8' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(within(met).queryByText(/Core would apply it at once/)).toBeNull();

    await u.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    const id = chip.getAttribute('aria-controls') as string;
    const note = document.getElementById(id) as HTMLElement;
    expect(note).toHaveTextContent(
      'If Remove a Minter Admin: Dex Demote passes, MINTER has 20 admin seats and the target drops from 9 to 8 signatures.'
    );
    expect(note).toHaveTextContent(
      'This decision has 8 signatures, so Core would apply it at once, in the same block or the next, with no new signature.'
    );
    expect(note).toHaveTextContent(/withdraw your signature before the admin change passes/);

    await u.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(id)).toBeNull();
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
      within(card(/^Remove a Minter Admin, Dex Demote/)).getByRole('button', { name: /^Sign: / })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Sign this decision' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      /target drops from 9 to 8 signatures.+Add to MINTER: Mia Met \(8 of 9\)/
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
    expect(await within(dialog).findByText('Signed', {}, T)).toBeInTheDocument();
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
        ).getByRole('button', { name: /^Sign: / })
      );
    await sign();
    let dialog = await screen.findByRole('dialog', { name: 'Sign this decision' });
    await u.click(within(dialog).getByRole('checkbox', { name: 'I’ve checked these' }));
    await u.click(within(dialog).getByRole('button', { name: 'Not now' }));
    await sign();
    dialog = await screen.findByRole('dialog', { name: 'Sign this decision' });
    expect(within(dialog).getByRole('checkbox', { name: 'I’ve checked these' })).not.toBeChecked();
  });

  it('signing a decision that only carries a chip needs no tick', async () => {
    const u = user();
    await openShifted();
    await u.click(within(card(/^Add to MINTER, Mia Met/)).getByRole('button', { name: /^Sign: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign this decision' });
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    expect(within(dialog).queryByRole('note')).toBeNull();
  });

  it('Sign several with an admin change in it needs the same tick', async () => {
    const u = user();
    await openShifted();
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'B1' }));
    await u.click(screen.getByRole('button', { name: 'Sign several' }));
    await u.click(screen.getByRole('checkbox', { name: /Dex Demote/ }));
    await u.click(screen.getByRole('checkbox', { name: /Ben Target/ }));
    await u.click(screen.getByRole('button', { name: 'Sign 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sign several' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(
      /^If Remove a Minter Admin: Dex Demote passes, MINTER has 20 admin seats and the target drops from 9 to 8 signatures\./
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

describe('Decisions: proposing an admin change', () => {
  it('says what it would do to the target before Hub opens, and needs the tick', async () => {
    const u = user();
    await openShifted();
    await u.click(screen.getByRole('button', { name: 'Propose' }));
    await u.click(await screen.findByRole('menuitem', { name: /Remove a Minter Admin/ }));
    const form = await screen.findByRole('dialog', { name: 'Remove a Minter Admin' });
    expect(within(form).getByText(/this can move the target for all of them/)).toBeVisible();
    const picker = within(form).getByRole('combobox', { name: 'Minter Admin' });
    const option = within(picker).getByRole('option', { name: 'Admin B' }) as HTMLOptionElement;
    await u.selectOptions(picker, option.value);
    expect(await within(form).findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.click(within(form).getByRole('button', { name: 'Review' }));

    const hub = await screen.findByRole('dialog', { name: /Remove a Minter Admin: Admin B/ });
    const note = within(hub).getByRole('note');
    expect(note).toHaveTextContent(
      'If this passes, MINTER has 20 admin seats and the target drops from 9 to 8 signatures.'
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

async function openPage() {
  await renderPage(<DecisionsPage />, {
    persona: 'admin',
    path: '/decisions',
    route: '/decisions',
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
}
