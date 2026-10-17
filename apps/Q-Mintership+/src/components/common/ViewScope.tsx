import { useContext, type ReactNode } from 'react';
import { ViewScopeContext } from '../../hooks/viewScope';

/** The views kept under this (useViewState) are its own: `name` under any scope around it. */
export function ViewScope({ name, children }: { name: string; children: ReactNode }) {
  const parent = useContext(ViewScopeContext);
  return (
    <ViewScopeContext value={parent ? `${parent}/${name}` : name}>{children}</ViewScopeContext>
  );
}
