/**
 * Shared factory for the qapp-core mock.
 *
 * Every test file that imports hooks using `useGlobal` / `useListReturn`
 * should declare:
 *
 *   vi.mock('qapp-core', () => import('../test/qappCoreMock').then(m => m.qappCoreModuleMock()));
 *
 * Then per-test, call makeGlobalMock() to configure what useGlobal returns:
 *
 *   import { useGlobal, useListReturn } from 'qapp-core';
 *   beforeEach(() => {
 *     vi.mocked(useGlobal).mockReturnValue(makeGlobalMock({ ... }));
 *     vi.mocked(useListReturn).mockReturnValue([]);
 *   });
 */
import { vi } from 'vitest';

export interface MockIdentifierOperations {
  hashString: ReturnType<typeof vi.fn>;
  buildSearchPrefix: ReturnType<typeof vi.fn>;
}

export interface MockLists {
  fetchResourcesResultsOnly: ReturnType<typeof vi.fn>;
  addList: ReturnType<typeof vi.fn>;
}

export interface MockAuth {
  name: string;
}

export interface GlobalMockOverrides {
  authName?: string;
  hashStringResult?: string | null;
  buildSearchPrefixResult?: string;
  listResults?: unknown[];
}

/**
 * Produces the full mock object that useGlobal() will return.
 */
export function makeGlobalMock(overrides: GlobalMockOverrides = {}) {
  const {
    authName = 'alice',
    hashStringResult = 'HASH',
    buildSearchPrefixResult = 'PREFIX',
    listResults = [],
  } = overrides;

  const identifierOperations: MockIdentifierOperations = {
    hashString: vi.fn(async (value: string) =>
      hashStringResult == null ? null : `${hashStringResult}${value}`
    ),
    buildSearchPrefix: vi.fn(
      async (_entityType: string, parentId: string) =>
        `${buildSearchPrefixResult}:${parentId}`
    ),
  };

  const lists: MockLists = {
    fetchResourcesResultsOnly: vi.fn(async () => listResults),
    addList: vi.fn(),
  };

  return {
    auth: authName ? { name: authName } : null,
    identifierOperations,
    lists,
  };
}

/**
 * The module-level factory used in vi.mock() calls.
 * Returns the complete mock shape for the 'qapp-core' module.
 */
export function qappCoreModuleMock() {
  return {
    useGlobal: vi.fn(),
    useListReturn: vi.fn(() => []),
    EnumCollisionStrength: { HIGH: 14, LOW: 8, MEDIUM: 11 },
    objectToBase64: vi.fn((obj: unknown) => btoa(JSON.stringify(obj))),
    QortalMetadata: {},
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showLoading: vi.fn(),
  };
}
