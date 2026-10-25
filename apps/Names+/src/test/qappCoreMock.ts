/**
 * Mock for the parts of qapp-core this app uses. Declare in a test file:
 *
 *   vi.mock('qapp-core', () => import('../test/qappCoreMock').then((m) => m.qappCoreModuleMock()));
 *
 * Then set what `useGlobal()` returns per test:
 *
 *   vi.mocked(useGlobal).mockReturnValue(makeGlobalMock({ address: 'Qabc' }));
 */
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

export interface GlobalMockOverrides {
  address?: string;
  name?: string;
}

export function makeGlobalMock(overrides: GlobalMockOverrides = {}) {
  const { address = 'QTestAddress', name = 'alice' } = overrides;
  return {
    auth: { address, name, isLoadingUser: false, balance: 100 },
  };
}

class RequestQueueWithPromiseMock {
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

export function qappCoreModuleMock() {
  return {
    useGlobal: vi.fn(() => makeGlobalMock()),
    useQortBalance: vi.fn(() => ({ value: 100, isLoading: false })),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showLoading: vi.fn(() => 'toast-id'),
    dismissToast: vi.fn(),
    Spacer: ({ height, width }: { height?: string; width?: string }) =>
      createElement('div', { style: { height, width } }),
    ImagePicker: ({ children }: { children?: ReactNode }) =>
      createElement('div', { 'data-testid': 'image-picker' }, children),
    RequestQueueWithPromise: RequestQueueWithPromiseMock,
    GlobalProvider: ({ children }: { children?: ReactNode }) => children ?? null,
  };
}
