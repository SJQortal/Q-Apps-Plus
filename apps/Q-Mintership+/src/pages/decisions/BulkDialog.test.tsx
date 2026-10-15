import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import type { WriteOutcome } from '../../writes/runner';
import { BulkDialog, type BulkOutcome, type BulkReport } from './BulkDialog';

describe('BulkDialog: what a screen reader hears', () => {
  it('keeps each outcome in the live region while the next item starts', async () => {
    const u = userEvent.setup();
    let report!: BulkReport;
    let finish!: (outcomes: WriteOutcome[]) => void;
    render(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <BulkDialog
          open
          onClose={() => {}}
          title="Approve several"
          action="SIGN_TRANSACTION"
          feeTxType="GROUP_APPROVAL"
          items={[
            { key: 'a', label: 'Add to MINTER: Ada' },
            { key: 'b', label: 'Remove from MINTER: Bo' },
          ]}
          confirmLabel="Continue to Hub"
          run={(r) => {
            report = r;
            return new Promise((resolve) => (finish = resolve));
          }}
        />
      </HubThemeProvider>
    );
    const dialog = screen.getByRole('dialog', { name: 'Approve several' });
    const live = within(dialog).getByRole('status');
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    // Its buttons go while it runs: focus waits on the title, not on the page.
    expect(within(dialog).getByRole('heading', { name: 'Approve several' })).toHaveFocus();

    act(() => report(0, null, 'waitingForHub'));
    expect(live).toHaveTextContent('1. Add to MINTER: Ada: Waiting for you in Hub…');

    // The outcome and the next item's first stage arrive together.
    const sent: WriteOutcome = { status: 'sent', tx: null, signature: 'S1', recovered: false };
    act(() => {
      report(0, sent);
      report(1, null, 'checking');
    });
    expect(live).toHaveTextContent('1. Add to MINTER: Ada: Sent ✓');
    expect(live).toHaveTextContent('2. Remove from MINTER: Bo: Checking the latest state');

    const declined: WriteOutcome = { status: 'declined' };
    await act(async () => {
      report(1, declined);
      finish([sent, declined]);
    });
    expect(live).toHaveTextContent('2. Remove from MINTER: Bo: Cancelled in Hub. Stopped here.');
    expect(live).toHaveTextContent('1 of 2 sent.');
    expect(within(dialog).getByRole('status')).toBe(live);
    // role="status" is atomic by default: every new stage would read the last outcome again.
    expect(live).toHaveAttribute('aria-atomic', 'false');
  });

  it('says which of two steps runs, and what step 2 signs', async () => {
    const u = userEvent.setup();
    let report!: BulkReport;
    let finish!: (outcomes: BulkOutcome[]) => void;
    render(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <BulkDialog
          open
          onClose={() => {}}
          title="Cancel stale invites"
          steps={[
            { action: 'CANCEL_GROUP_INVITE', title: 'Propose it' },
            { action: 'SIGN_TRANSACTION', title: 'Approve it', check: ['Tick the box.'] },
          ]}
          feeTxType="CANCEL_GROUP_INVITE"
          items={[{ key: 'a', label: 'Invite for Ada' }]}
          confirmLabel="Continue to Hub"
          sentLabel="Proposed and approved ✓"
          summarize={({ sent, partial }) => `${sent} signed, ${partial} without a signature.`}
          run={(r) => {
            report = r;
            return new Promise((resolve) => (finish = resolve));
          }}
        />
      </HubThemeProvider>
    );
    const dialog = screen.getByRole('dialog', { name: 'Cancel stale invites' });
    expect(within(dialog).getByText('2 Hub confirmations, two for each, one after another:'));
    expect(within(dialog).getByText('Tick the box.')).toBeVisible();
    expect(within(dialog).getByText(/Fees in total: 0.02 QORT/)).toBeVisible();
    const live = within(dialog).getByRole('status');
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));

    act(() => report(0, null, { step: 0, stage: 'waitingForHub' }));
    expect(live).toHaveTextContent('1. Invite for Ada: Step 1 of 2, propose it: Waiting for you');
    act(() => report(0, null, { step: 1, stage: 'waitingForHub', signature: 'Sig12345XYZ' }));
    expect(live).toHaveTextContent('Step 2 of 2, approve it: Waiting for you in Hub…');
    expect(live).toHaveTextContent('"pendingSignature" starts with Sig12345.');
    expect(within(dialog).getByText('Sig12345')).toBeVisible();

    const partial: BulkOutcome = {
      status: 'sent',
      tx: null,
      signature: 'P1',
      recovered: false,
      partial: 'Proposed ✓. Your signature didn’t go through.',
    };
    await act(async () => {
      report(0, partial);
      finish([partial]);
    });
    expect(live).toHaveTextContent(
      '1. Invite for Ada: Proposed ✓. Your signature didn’t go through.'
    );
    expect(live).toHaveTextContent('0 signed, 1 without a signature.');
  });
});
