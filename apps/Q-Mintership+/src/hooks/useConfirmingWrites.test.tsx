import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import {
  CONFIRMING_WINDOW_MS,
  markWrite,
  pendingWritesAtom,
  useConfirmingWrites,
} from '../writes/optimistic';

afterEach(() => getDefaultStore().set(pendingWritesAtom, {}));

describe('useConfirmingWrites: the live views refresh faster after a write', () => {
  it('is false with nothing sent', () => {
    expect(renderHook(() => useConfirmingWrites()).result.current).toBe(false);
  });

  it('is true while a write waits for its block, not while it is still being sent', () => {
    const { result } = renderHook(() => useConfirmingWrites());
    act(() => markWrite('sign:abc', 'sending'));
    expect(result.current).toBe(false);
    act(() => markWrite('sign:abc', 'confirming', { signature: 'abc' }));
    expect(result.current).toBe(true);
  });

  it('stops after the confirming window, so a lost write never keeps it fast', () => {
    getDefaultStore().set(pendingWritesAtom, {
      'sign:old': {
        key: 'sign:old',
        status: 'confirming',
        signature: 'old',
        at: Date.now() - CONFIRMING_WINDOW_MS - 1_000,
      },
    });
    expect(renderHook(() => useConfirmingWrites()).result.current).toBe(false);
  });
});
