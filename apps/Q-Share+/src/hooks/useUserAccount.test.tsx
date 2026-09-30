import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../state/store';
import { addUser } from '../state/features/authSlice';
import { mockQortalAction, qortalCallsFor } from '../test/setup';
import { ACCOUNT_RETRY_MS, useUserAccount } from './useUserAccount';

const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

// What Hub's app frame receives when its 30 s limit ends before the dialog does.
const HUB_TIMEOUT = {
  error: 'Request timed out after 30000 ms (action: GET_USER_ACCOUNT)',
  message: 'Request timed out after 30000 ms (action: GET_USER_ACCOUNT)',
};
// What Hub sends for any failed GET_USER_ACCOUNT, a declined Authenticate dialog included.
const DECLINED = { error: 'Unable to get user account', message: 'Unable to get user account' };

/** GET_USER_ACCOUNT fails with `firstError`, then succeeds. */
function mockAccount(firstError?: unknown) {
  let calls = 0;
  mockQortalAction('GET_USER_ACCOUNT', () => {
    calls += 1;
    if (calls === 1 && firstError) throw firstError;
    return { address: 'Qabc', publicKey: 'k' };
  });
  mockQortalAction('GET_ACCOUNT_NAMES', [{ name: 'alice', owner: 'Qabc' }]);
  mockQortalAction('GET_PRIMARY_NAME', 'alice');
}

describe('useUserAccount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.dispatch(addUser(null));
  });
  afterEach(() => {
    vi.useRealTimers();
    store.dispatch(addUser(null));
  });

  it('signs in on mount with the primary name and all names', async () => {
    mockAccount();
    renderHook(() => useUserAccount(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().auth.user).toMatchObject({ address: 'Qabc', name: 'alice', names: [{ name: 'alice' }] });
  });

  it("asks once more after Hub's dialog has gone when the request timed out", async () => {
    mockAccount(HUB_TIMEOUT);
    renderHook(() => useUserAccount(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().auth.user).toBeNull();
    expect(qortalCallsFor('GET_USER_ACCOUNT')).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(ACCOUNT_RETRY_MS - 1);
    expect(qortalCallsFor('GET_USER_ACCOUNT')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(qortalCallsFor('GET_USER_ACCOUNT')).toHaveLength(2);
    expect(store.getState().auth.user?.name).toBe('alice');
  });

  it('retries only once', async () => {
    mockQortalAction('GET_USER_ACCOUNT', () => {
      throw HUB_TIMEOUT;
    });
    renderHook(() => useUserAccount(), { wrapper });
    await vi.advanceTimersByTimeAsync(ACCOUNT_RETRY_MS * 3);
    expect(qortalCallsFor('GET_USER_ACCOUNT')).toHaveLength(2);
  });

  it('does not ask again after a decline, and does not log it as an error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockAccount(DECLINED);
      renderHook(() => useUserAccount(), { wrapper });
      await vi.advanceTimersByTimeAsync(ACCOUNT_RETRY_MS * 2);
      expect(qortalCallsFor('GET_USER_ACCOUNT')).toHaveLength(1);
      expect(store.getState().auth.user).toBeNull();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('drops the pending retry on unmount', async () => {
    mockAccount(HUB_TIMEOUT);
    const { unmount } = renderHook(() => useUserAccount(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    unmount();
    await vi.advanceTimersByTimeAsync(ACCOUNT_RETRY_MS * 2);
    expect(qortalCallsFor('GET_USER_ACCOUNT')).toHaveLength(1);
  });
});
