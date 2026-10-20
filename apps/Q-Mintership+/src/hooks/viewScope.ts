import { createContext } from 'react';

/**
 * Where a view kept by useViewState sits on its page ("connections",
 * "connections/circle:in:Q…"): the ids under one scope don't meet those
 * under another (the same transaction in two tabs, or in a dialog over a
 * list). Set with components/common/ViewScope.
 */
export const ViewScopeContext = createContext('');
