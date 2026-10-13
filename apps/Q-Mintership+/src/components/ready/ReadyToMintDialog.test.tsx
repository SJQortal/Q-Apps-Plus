/**
 * The ready-to-mint dialog against the mock world: the three boxes are all
 * needed, a balance below the fee blocks it, the answers aren't kept, and
 * the Hub step sends JOIN_GROUP only when the person confirms (declined or
 * answered by the test; nothing reaches a node).
 */
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { signerOf, useSession } from '../../state/session';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { getPendingWrite, pendingWritesAtom, writeKeys } from '../../writes/optimistic';
import { ReadyToMintDialog } from './ReadyToMintDialog';

afterEach(() => vi.useRealTimers());

const T = { timeout: 3000 };
const TITLE = "Show you're ready to mint";

function Harness({ onSuccess }: { onSuccess?: () => void }) {
  const signer = signerOf(useSession());
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open again
      </button>
      <ReadyToMintDialog
        open={open}
        onClose={() => setOpen(false)}
        signer={signer}
        needed={8}
        onSuccess={onSuccess}
      />
    </>
  );
}

async function checklist() {
  return screen.findByRole('dialog', { name: TITLE }, T);
}

/** The Hub step: the dialog that holds "Continue to Hub" (the checklist may still be closing). */
async function hubStep() {
  const button = await screen.findByRole('button', { name: 'Continue to Hub' }, T);
  return button.closest<HTMLElement>('[role="dialog"]') as HTMLElement;
}

async function tickAll(dialog: HTMLElement) {
  for (const box of within(dialog).getAllByRole('checkbox')) await userEvent.click(box);
}

/** Makes Hub "accept" the next JOIN_GROUP, answering like Hub with the new transaction. */
function hubAcceptsJoin(address: string) {
  mockQortalRequest('JOIN_GROUP', () => ({
    type: 'JOIN_GROUP',
    signature: 'testReadySignature111111111111111111111111111111111111111111111',
    timestamp: Date.now(),
    groupId: 694,
    txGroupId: 0,
    creatorAddress: address,
  }));
}

describe('ReadyToMintDialog: the self-check', () => {
  it('needs all three boxes before Hub, and says which are missing', async () => {
    await renderPage(<Harness />, { persona: 'newcomerName' });
    const dialog = await checklist();
    expect(
      await within(dialog).findByText(/12\.5 QORT, so that's covered/, {}, T)
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Yours is/)).toHaveTextContent('Yours is Zoë Newcomer');
    const boxes = within(dialog).getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    expect(boxes[0]).toBeRequired();
    expect(boxes[0]).toHaveAccessibleDescription(/levels grow with time online/);

    const go = within(dialog).getByRole('button', { name: 'Continue' });
    await waitFor(() => expect(go).toBeEnabled());
    await userEvent.click(go);
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      "Can't continue yet: tick 3 more boxes above."
    );
    expect(boxes[0]).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Continue to Hub' })).toBeNull();

    await userEvent.click(boxes[0]);
    await userEvent.click(boxes[2]);
    await userEvent.click(go);
    expect(within(dialog).getByRole('status')).toHaveTextContent('tick 1 more box above');
    expect(boxes[1]).toHaveFocus();
    expect(boxes[1]).toHaveAccessibleDescription('Tick this to continue.');
    expect(screen.queryByRole('button', { name: 'Continue to Hub' })).toBeNull();

    await userEvent.click(boxes[1]);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Ready.');
    await userEvent.click(go);
    const hub = await hubStep();
    expect(hub).toHaveAccessibleName(TITLE);
    expect(within(hub).getByText(/Hub asks you to confirm joining the group MINTER/));
    expect(within(hub).getByText('Fee: 0.01 QORT')).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toHaveLength(0);

    // Back keeps the ticks.
    await userEvent.click(within(hub).getByRole('button', { name: 'Back to the form' }));
    const again = await screen.findAllByRole('checkbox', {}, T);
    expect(again).toHaveLength(3);
    again.forEach((box) => expect(box).toBeChecked());
  }, 20_000);

  it("keeps the answers nowhere: they aren't saved, and a new opening starts fresh", async () => {
    const before = window.localStorage.length;
    await renderPage(<Harness />, { persona: 'newcomerName' });
    const dialog = await checklist();
    await tickAll(dialog);
    expect(window.localStorage.length).toBe(before);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Open again' }));
    const fresh = await checklist();
    within(fresh)
      .getAllByRole('checkbox')
      .forEach((box) => expect(box).not.toBeChecked());
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
  }, 20_000);

  it('blocks on a balance below the fee, says how to get QORT, and checks again', async () => {
    const { world, address } = await renderPage(<Harness />, { persona: 'newcomer' });
    const dialog = await checklist();
    expect(
      await within(dialog).findByText('You need 0.01 QORT for the fee first.', {}, T)
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Your confirmed balance is 0 QORT\. Ask someone you know/));
    expect(within(dialog).getByText(address)).toBeInTheDocument();
    await tickAll(dialog);
    const go = within(dialog).getByRole('button', { name: 'Continue' });
    expect(go).toBeDisabled();
    expect(
      within(dialog).getByText(
        'Continue opens once your confirmed balance covers the 0.01 QORT fee.'
      )
    ).toHaveAttribute('role', 'status');

    // Pressed before the QORT has confirmed: it says it checked, and what it found.
    const recheck = within(dialog).getByRole('button', { name: 'Check again' });
    await userEvent.click(recheck);
    expect(
      await within(dialog).findByText('Checked just now: still 0 QORT confirmed.', {}, T)
    ).toHaveAttribute('role', 'status');
    expect(recheck).toHaveFocus();

    // Someone sent a little QORT.
    world.accounts.get(address)!.balance = 1;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Check again' }));
    expect(await within(dialog).findByText(/1 QORT, so that's covered/, {}, T)).toBeInTheDocument();
    expect(go).toBeEnabled();
  }, 20_000);

  it('shows Check again working on a slow node, and keeps focus on it', async () => {
    let release: (() => void) | null = null;
    const { address } = await renderPage(<Harness />, { persona: 'newcomer' });
    const dialog = await checklist();
    await within(dialog).findByText('You need 0.01 QORT for the fee first.', {}, T);
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Check again' })).toBeInTheDocument()
    );
    mockFetchRoute('/addresses/balance/', async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return '0';
    });
    const reads = () => fetchCallsFor(`/addresses/balance/${address}`).length;
    const before = reads();
    const recheck = within(dialog).getByRole('button', { name: 'Check again' });
    await userEvent.click(recheck);
    expect(await within(dialog).findByRole('button', { name: 'Checking…' }, T)).toBe(recheck);
    expect(recheck).toBeEnabled();
    expect(recheck).toHaveFocus();
    expect(within(dialog).getByText('Checking your confirmed balance…')).toBeInTheDocument();
    await userEvent.click(recheck);
    expect(reads()).toBe(before + 1);
    release!();
    expect(
      await within(dialog).findByText('Checked just now: still 0 QORT confirmed.', {}, T)
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Check again' })).toBe(recheck);
  }, 20_000);

  it('says the balance is still being checked, not Ready, while Continue waits for it', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await renderPage(<Harness />, {
      persona: 'newcomerName',
      setup: () =>
        mockFetchRoute('/addresses/balance/', async () => {
          await gate;
          return '12.5';
        }),
    });
    const dialog = await checklist();
    await tickAll(dialog);
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Checking your balance for the 0.01 QORT fee…'
    );
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeDisabled();
    release();
    expect(
      await within(dialog).findByText(/12\.5 QORT, so that's covered/, {}, T)
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Ready. Next, Hub asks you to confirm.'
    );
    expect(within(dialog).getByRole('button', { name: 'Continue' })).toBeEnabled();
  }, 20_000);

  it('offers a name as optional, through the Names app', async () => {
    await renderPage(<Harness />, { persona: 'newcomer' });
    const dialog = await checklist();
    expect(within(dialog).getByText(/It isn.t required/)).toBeInTheDocument();
    mockQortalRequest('OPEN_NEW_TAB', true);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register a name' }));
    expect(qortalCallsFor('OPEN_NEW_TAB')[0]).toMatchObject({ qortalLink: 'qortal://APP/Names' });
  }, 20_000);
});

describe('ReadyToMintDialog: the Hub step', () => {
  async function toHub() {
    const dialog = await checklist();
    await within(dialog).findByText(/so that's covered/, {}, T);
    await tickAll(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    const hub = await hubStep();
    await userEvent.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    return hub;
  }

  it('sends nothing when Hub is declined', async () => {
    const onSuccess = vi.fn();
    const { address, posts } = await renderPage(<Harness onSuccess={onSuccess} />, {
      persona: 'newcomerName',
    });
    const hub = await toHub();
    expect(
      await within(hub).findByText(/Cancelled in Hub\. Nothing was sent\./, {}, T)
    ).toBeInTheDocument();
    expect(qortalCallsFor('JOIN_GROUP')).toEqual([{ action: 'JOIN_GROUP', groupId: 694 }]);
    expect(getPendingWrite(writeKeys.join(address))).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(posts).toEqual([]);
  }, 20_000);

  it('marks it once Hub sends the join request', async () => {
    const onSuccess = vi.fn();
    const { address, posts } = await renderPage(<Harness onSuccess={onSuccess} />, {
      persona: 'newcomerName',
    });
    hubAcceptsJoin(address);
    const hub = await toHub();
    expect(
      await within(hub).findByText("You've shown you're ready to mint ✓", {}, T)
    ).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(getPendingWrite(writeKeys.join(address))?.status).toBe('confirming');
    expect(posts).toEqual([]);
    getDefaultStore().set(pendingWritesAtom, {});
  }, 20_000);
});
