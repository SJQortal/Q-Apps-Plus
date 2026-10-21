import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { AnchoredNote } from './AnchoredNote';

function Harness({ autoHideMs }: { autoHideMs?: number }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <p>
        <button
          ref={setAnchor}
          onClick={() => {
            setCount((n) => n + 1);
            setOpen(true);
          }}
        >
          Add
        </button>
      </p>
      <AnchoredNote
        anchor={anchor}
        open={open}
        onClose={() => setOpen(false)}
        autoHideMs={autoHideMs}
      >
        Added ({count})
      </AnchoredNote>
      <button>Elsewhere</button>
    </HubThemeProvider>
  );
}

describe('AnchoredNote', () => {
  it('opens beside its button in a polite live region, and a second press keeps it open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const note = await screen.findByText('Added (1)');
    expect(note.closest('[aria-live="polite"]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Added (2)')).toBeInTheDocument();
  });

  it('closes on a press elsewhere, and with Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByText('Added (1)');
    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(screen.queryByText('Added (1)')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByText('Added (2)');
    await user.keyboard('{Escape}');
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(screen.queryByText('Added (2)')).toBeNull();
  });

  it('closes by itself after a while', async () => {
    const user = userEvent.setup();
    render(<Harness autoHideMs={50} />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitForElementToBeRemoved(() => screen.queryByText('Added (1)'), { timeout: 2000 });
  });
});
