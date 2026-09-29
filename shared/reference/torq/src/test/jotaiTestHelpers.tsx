/**
 * Jotai test helpers
 *
 * Provides a simple wrapper for renderHook / render calls that need
 * an isolated Jotai store with pre-seeded atom values.
 *
 * Usage:
 *   const store = createTestStore([[myAtom, initialValue]]);
 *   const { result } = renderHook(() => useMyHook(), {
 *     wrapper: jotaiWrapper(store),
 *   });
 */
import React from 'react';
import { createStore, atom as jotaiAtom } from 'jotai';
import { Provider } from 'jotai';

export { createStore };

type AnyWritableAtom = ReturnType<typeof jotaiAtom>;
type AtomSeed = [AnyWritableAtom, unknown];

/**
 * Creates a fresh Jotai store pre-seeded with the given atom values.
 */
export function createTestStore(seeds: AtomSeed[] = []) {
  const store = createStore();
  seeds.forEach(([a, v]) => store.set(a as any, v));
  return store;
}

/**
 * Returns a React wrapper component that provides the given Jotai store.
 * Pass it as the `wrapper` option in renderHook or render.
 */
export function jotaiWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}
