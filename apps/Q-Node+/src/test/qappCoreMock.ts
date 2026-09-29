/**
 * Mock for the parts of qapp-core this app uses. Declare in a test file:
 *
 *   vi.mock('qapp-core', () => import('../test/qappCoreMock').then((m) => m.qappCoreModuleMock()));
 *
 * Then set what `useAuth()` returns per test:
 *
 *   vi.mocked(useAuth).mockReturnValue(makeAuthMock({ address: 'Qabc' }));
 */
import type { ReactNode } from 'react';
import { vi } from 'vitest';

export interface AuthMockOverrides {
  address?: string | null;
  name?: string | null;
}

export function makeAuthMock(overrides: AuthMockOverrides = {}) {
  const { address = 'QTestAddress', name = 'alice' } = overrides;
  return { address, name, isLoadingUser: false, balance: 100 };
}

export function qappCoreModuleMock() {
  return {
    useAuth: vi.fn(() => makeAuthMock()),
    useGlobal: vi.fn(() => ({ auth: makeAuthMock() })),
    showError: vi.fn(),
    showSuccess: vi.fn(),
    GlobalProvider: ({ children }: { children?: ReactNode }) =>
      children ?? null,
  };
}
