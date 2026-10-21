import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { heavy, HeavyCancelled, heavyLoad } from '../data/explorer/heavy';
import { useHeavyScope } from './useHeavyScope';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function View({ scope }: { scope: string | null }) {
  useHeavyScope(scope);
  return null;
}

describe('useHeavyScope', () => {
  it('drops the queued reads of an account the view leaves, and when it closes', async () => {
    const gate = deferred();
    // Two slots busy, so everything else waits in the queue.
    const running = [heavy('busy', () => gate.promise), heavy('busy', () => gate.promise)];
    const first = heavy('QA', async () => 'a');
    const second = heavy('QB', async () => 'b');
    const kept = heavy('QC', async () => 'c');
    first.catch(() => {});
    second.catch(() => {});
    await tick();
    expect(heavyLoad()).toEqual({ running: 2, queued: 3 });

    const view = render(<View scope="QA" />);
    // Another account: QA's queued read goes, QB's stays queued.
    view.rerender(<View scope="QB" />);
    await expect(first).rejects.toBeInstanceOf(HeavyCancelled);
    expect(heavyLoad()).toEqual({ running: 2, queued: 2 });
    // The view closes: QB's goes too; QC's (no view of it here) stays.
    view.unmount();
    await expect(second).rejects.toBeInstanceOf(HeavyCancelled);
    expect(heavyLoad()).toEqual({ running: 2, queued: 1 });

    gate.resolve();
    await Promise.all(running);
    await expect(kept).resolves.toBe('c');
  });

  it('does nothing without a scope', () => {
    const view = render(<View scope={null} />);
    expect(() => view.unmount()).not.toThrow();
  });
});
