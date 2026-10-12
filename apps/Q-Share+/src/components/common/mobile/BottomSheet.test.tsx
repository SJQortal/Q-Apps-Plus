import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { BottomSheet } from './BottomSheet';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <BottomSheet
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Save to collection"
      >
        <button type="button" onClick={() => setOpen(false)}>
          Done
        </button>
      </BottomSheet>
    </>
  );
}

const touchListenerCount = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter(([type]) => String(type).startsWith('touch')).length;

describe('BottomSheet', () => {
  it('mounts nothing and adds no document touch listeners while closed', () => {
    const spy = vi.spyOn(document, 'addEventListener');
    try {
      renderWithProviders(
        <>
          {[0, 1, 2, 3, 4].map((n) => (
            <BottomSheet key={n} open={false} onClose={() => {}} title={`Sheet ${n}`}>
              <p>Body {n}</p>
            </BottomSheet>
          ))}
        </>
      );
      expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
      expect(screen.queryByText('Body 0')).not.toBeInTheDocument();
      expect(touchListenerCount(spy)).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('mounts on open and unmounts once the close slide has finished', async () => {
    renderWithProviders(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('dialog', { name: 'Save to collection' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // Still there during the slide, then gone.
    expect(screen.getByRole('dialog', { name: 'Save to collection', hidden: true })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
  });

  it('can be reopened after closing', async () => {
    renderWithProviders(<Harness />);
    for (let round = 0; round < 2; round += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      expect(await screen.findByRole('dialog', { name: 'Save to collection' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
    }
  });

  it('still closes when the sheet is dragged down', async () => {
    const onClose = vi.fn();
    renderWithProviders(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const paper = await screen.findByRole('dialog', { name: 'Save to collection' });
    // jsdom has no layout: give the paper a height so the drag distance means something.
    Object.defineProperty(paper, 'clientHeight', { configurable: true, value: 400 });

    const at = (clientY: number) => [{ identifier: 0, target: paper, clientX: 100, pageX: 100, clientY, pageY: clientY }];
    fireEvent.touchStart(paper, { touches: at(500), changedTouches: at(500) });
    fireEvent.touchMove(paper, { touches: at(520), changedTouches: at(520) });
    fireEvent.touchMove(paper, { touches: at(640), changedTouches: at(640) });
    fireEvent.touchMove(paper, { touches: at(760), changedTouches: at(760) });
    fireEvent.touchEnd(paper, { touches: [], changedTouches: at(760) });

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument());
  });
});
