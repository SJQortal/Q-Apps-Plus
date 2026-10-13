import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import type { ChainNow } from '../data/chain';
import { setQueryData } from '../data/query';
import { TIP } from '../../e2e/world.mjs';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import { installWorld } from '../test/world';
import {
  CONFIRMING_WINDOW_MS,
  getPendingWrite,
  markWrite,
  pendingWritesAtom,
  settleWrite,
  useConfirmingWrites,
  writeKeys,
} from '../writes/optimistic';
import { useSettleConfirmingWrites } from './useSettleConfirmingWrites';

afterEach(() => {
  getDefaultStore().set(pendingWritesAtom, {});
  vi.useRealTimers();
});

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

  it('is false for a Considering record: it changes none of the live views', () => {
    const { result } = renderHook(() => useConfirmingWrites());
    act(() => markWrite(writeKeys.considering('k'), 'confirming', { signature: 'c1' }));
    act(() => markWrite(writeKeys.notConsidering('k'), 'confirming', { signature: 'c2' }));
    expect(result.current).toBe(false);
    act(() => markWrite(writeKeys.sign('abc'), 'confirming', { signature: 'abc' }));
    expect(result.current).toBe(true);
  });

  it('is false once the write is on chain (settleWrite), before the window ends', () => {
    const { result } = renderHook(() => useConfirmingWrites());
    act(() => markWrite('sign:abc', 'confirming', { signature: 'abc' }));
    expect(result.current).toBe(true);
    // Another signature on the key isn't this write: nothing changes.
    act(() => settleWrite('sign:abc', 'other'));
    expect(result.current).toBe(true);
    act(() => settleWrite('sign:abc', 'abc'));
    expect(result.current).toBe(false);
    // Still "(confirming…)" for the views until they show the answer.
    expect(getPendingWrite('sign:abc')).toMatchObject({ status: 'confirming', signature: 'abc' });
    // A new write on the same key starts fresh.
    act(() => markWrite('sign:abc', 'confirming', { signature: 'abd' }));
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

describe('useSettleConfirmingWrites: back to the usual pace once the write is in a block', () => {
  it('looks the write up at each new tip, and settles it when it has a block', async () => {
    installWorld('admin');
    let inBlock = false;
    mockFetchRoute('/transactions/signature/SettleSig1', () => ({
      type: 'GROUP_APPROVAL',
      signature: 'SettleSig1',
      timestamp: 1,
      ...(inBlock ? { blockHeight: TIP + 1 } : {}),
    }));
    const { result } = renderHook(() => {
      useSettleConfirmingWrites();
      return useConfirmingWrites();
    });
    act(() => markWrite('sign:settle', 'confirming', { signature: 'SettleSig1' }));
    // Not in a block yet: still fast.
    await waitFor(() =>
      expect(fetchCallsFor('/transactions/signature/SettleSig1')).toHaveLength(1)
    );
    expect(result.current).toBe(true);
    // The next block has it.
    inBlock = true;
    act(() =>
      setQueryData<ChainNow>('chain:now', (now) => ({
        ...(now as ChainNow),
        height: (now as ChainNow).height + 1,
      }))
    );
    await waitFor(() => expect(result.current).toBe(false));
    expect(fetchCallsFor('/transactions/signature/SettleSig1')).toHaveLength(2);
    expect(getPendingWrite('sign:settle')).toMatchObject({ status: 'confirming' });
    expect(getPendingWrite('sign:settle')?.onChainAt).toBeTypeOf('number');
  });

  it('reads nothing while no write waits for its block', async () => {
    installWorld('admin');
    renderHook(() => useSettleConfirmingWrites());
    act(() => markWrite(writeKeys.considering('k'), 'confirming', { signature: 'NoteSig' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchCallsFor('/transactions/signature/')).toEqual([]);
    expect(fetchCallsFor('/blocks')).toEqual([]);
  });
});
