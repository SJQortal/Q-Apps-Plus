import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import type { WriteOutcome, WriteStage } from '../../writes/runner';
import { HubStepDialog } from './HubStepDialog';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function open(run: (report: (step: number, stage: WriteStage) => void) => Promise<WriteOutcome>) {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <HubStepDialog
        open
        onClose={() => {}}
        title="Sign this decision"
        steps={[{ action: 'SIGN_TRANSACTION', title: 'Sign it', feeTxType: 'GROUP_APPROVAL' }]}
        run={async (report) => ({ outcome: await run(report) })}
        successTitle="Signed"
      />
    </HubThemeProvider>
  );
  return screen.getByRole('dialog', { name: 'Sign this decision' });
}

describe('HubStepDialog: what a screen reader hears', () => {
  it('speaks each stage and the result through one live region that was there from the start', async () => {
    const u = userEvent.setup();
    const answer = deferred<WriteOutcome>();
    let report!: (step: number, stage: WriteStage) => void;
    const dialog = open((r) => {
      report = r;
      return answer.promise;
    });
    const live = within(dialog).getByRole('status');
    expect(live).toBeEmptyDOMElement();

    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    report(0, 'waitingForHub');
    expect(await within(live).findByText('Waiting for you in Hub…')).toBeInTheDocument();

    answer.resolve({ status: 'declined' });
    expect(await within(live).findByText('Cancelled in Hub. Nothing was sent.')).toBeVisible();
    // The same region, not a new one, and focus on the result's button.
    expect(within(dialog).getByRole('status')).toBe(live);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('makes a failure an alert, and focuses the button that does not send again', async () => {
    const u = userEvent.setup();
    const dialog = open(async () => ({ status: 'failed', message: 'Core said no.' }));
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Core said no.');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(within(dialog).getByRole('status')).toBeEmptyDOMElement();
  });
});

function Reopenable() {
  const [open, setOpen] = useState(true);
  return (
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <button onClick={() => setOpen(true)}>Open again</button>
      <HubStepDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Propose it"
        steps={[{ action: 'BAN_FROM_GROUP', title: 'Propose it', feeTxType: 'GROUP_BAN' }]}
        run={async () => ({ outcome: { status: 'declined' } })}
      />
    </HubThemeProvider>
  );
}

describe('HubStepDialog: opening again', () => {
  it('starts fresh, and a quick reopen keeps its own result', async () => {
    const u = userEvent.setup();
    render(<Reopenable />);
    let dialog = screen.getByRole('dialog', { name: 'Propose it' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await within(dialog).findByText('Cancelled in Hub. Nothing was sent.');
    await u.click(within(dialog).getByRole('button', { name: 'Close' }));
    await u.click(screen.getByRole('button', { name: 'Open again', hidden: true }));
    dialog = (await screen.findAllByRole('dialog', { name: 'Propose it' })).at(-1)!;
    // Fresh: the intro again.
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await within(dialog).findByText('Cancelled in Hub. Nothing was sent.');
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(within(dialog).getByText('Cancelled in Hub. Nothing was sent.')).toBeVisible();
  });
});
