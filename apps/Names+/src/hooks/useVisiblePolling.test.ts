import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisiblePolling } from './useVisiblePolling';

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useVisiblePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => vi.useRealTimers());

  it('runs at once, then on the interval, and stops while the tab is hidden', async () => {
    const task = vi.fn(async () => {});
    renderHook(() => useVisiblePolling(task, 1000));
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(task).toHaveBeenCalledTimes(2);

    act(() => setVisibility('hidden'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(task).toHaveBeenCalledTimes(2);

    // Overdue when it comes back, so it runs immediately.
    await act(async () => {
      setVisibility('visible');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(task).toHaveBeenCalledTimes(3);
  });

  it('backs off after failures and waits for the first tick when not immediate', async () => {
    const task = vi.fn(async () => {
      throw new Error('node down');
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useVisiblePolling(task, 1000, true, { immediate: false }));
    expect(task).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(task).toHaveBeenCalledTimes(2);
    errors.mockRestore();
  });

  it('does nothing while disabled', async () => {
    const task = vi.fn();
    renderHook(() => useVisiblePolling(task, 1000, false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(task).not.toHaveBeenCalled();
  });
});
