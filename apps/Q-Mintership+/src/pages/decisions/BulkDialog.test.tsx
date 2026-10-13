import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import type { WriteOutcome } from '../../writes/runner';
import { BulkDialog, type BulkReport } from './BulkDialog';

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
          title="Sign several"
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
    const dialog = screen.getByRole('dialog', { name: 'Sign several' });
    const live = within(dialog).getByRole('status');
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));

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
  });
});
