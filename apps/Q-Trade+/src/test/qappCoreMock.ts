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
  /** What persistentOperations.getData resolves for each key. */
  saved?: Record<string, unknown>;
}

export function makeGlobalMock(overrides: GlobalMockOverrides = {}) {
  const { address = 'QTestAddress', name = 'alice', saved = {} } = overrides;
  const store: Record<string, unknown> = { ...saved };
  return {
    auth: { address, name, publicKey: 'TestPublicKey', isLoadingUser: false, balance: 100 },
    persistentOperations: {
      saveData: vi.fn(async (key: string, value: unknown) => {
        store[key] = value;
      }),
      getData: vi.fn(async (key: string) => store[key] ?? null),
    },
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
    usePublish: vi.fn(() => ({ resource: null, isLoading: false, error: null })),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showLoading: vi.fn(() => 'toast-id'),
    dismissToast: vi.fn(),
    RequestQueueWithPromise: RequestQueueWithPromiseMock,
    GlobalProvider: ({ children }: { children?: ReactNode }) => children ?? null,
    Spacer: ({ height, width }: { height?: string; width?: string }) =>
      createElement('div', { style: { height, width } }),
  };
}
