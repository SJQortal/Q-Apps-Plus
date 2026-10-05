/**
 * Mock for the parts of qapp-core this app uses. Declare in a test file:
 *
 *   vi.mock('qapp-core', () => import('../test/qappCoreMock').then((m) => m.qappCoreModuleMock()));
 *
 * Then set what `useGlobal()` / `useAuth()` return per test:
 *
 *   vi.mocked(useAuth).mockReturnValue(makeAuthMock({ name: 'alice' }));
 */
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

export interface AuthMockOverrides {
  address?: string;
  name?: string;
  avatarUrl?: string | null;
  balance?: number;
}

export function makeAuthMock(overrides: AuthMockOverrides = {}) {
  const { address = 'QTestAddress', name = 'alice', avatarUrl = null, balance = 100 } = overrides;
  return {
    address,
    name,
    avatarUrl,
    balance,
    isLoadingUser: false,
    switchName: vi.fn(),
  };
}

export function makeGlobalMock(overrides: AuthMockOverrides = {}) {
  return {
    auth: makeAuthMock(overrides),
    lists: {
      fetchResources: vi.fn(async () => []),
      fetchResourcesResultsOnly: vi.fn(async () => []),
      deleteList: vi.fn(),
    },
    identifierOperations: {
      hashString: vi.fn(async (value: string) => `hash-${value}`),
      buildSearchPrefix: vi.fn(async (entity: string, parent: string) => `${entity}-${parent}-`),
    },
    persistentOperations: {
      getData: vi.fn(async () => null),
      setData: vi.fn(async () => undefined),
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
    useAuth: vi.fn(() => makeAuthMock()),
    usePublish: vi.fn(() => ({ fetchPublish: vi.fn(async () => ({ hasResource: false })) })),
    useResourceStatus: vi.fn(() => ({ status: 'READY', percentLoaded: 100, isReady: true })),
    useQortBalance: vi.fn(() => ({ value: 100, isLoading: false })),
    useProgressStore: vi.fn(() => ({ getProgress: () => 0, setProgress: vi.fn() })),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showLoading: vi.fn(() => 'toast-id'),
    dismissToast: vi.fn(),
    EnumCollisionStrength: { LOW: 8, MEDIUM: 11, HIGH: 14 },
    hashWordWithoutPublicSalt: vi.fn(async (value: string) => `hash-${value}`),
    objectToBase64: vi.fn(async (obj: unknown) => btoa(JSON.stringify(obj))),
    Spacer: ({ height, width }: { height?: string; width?: string }) =>
      createElement('div', { style: { height, width } }),
    RequestQueueWithPromise: RequestQueueWithPromiseMock,
    GlobalProvider: ({ children }: { children?: ReactNode }) => children ?? null,
  };
}
