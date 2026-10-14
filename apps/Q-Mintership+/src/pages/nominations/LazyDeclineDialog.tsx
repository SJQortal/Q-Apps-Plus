/**
 * Propose's own dialog (Decisions → Propose → Decline a join request) for
 * one person on Ready to mint, picked already: loaded the first time it
 * opens, so the write code stays out of the list's first load.
 */
import { lazy, Suspense, useState } from 'react';
import type { ProposeDialogProps } from '../decisions/ProposeDialog';

const ProposeDialog = lazy(() =>
  import('../decisions/ProposeDialog').then((m) => ({ default: m.ProposeDialog }))
);

/** Propose's dialog for one decline, mounted the first time it opens. */
export function LazyDeclineDialog(
  props: Omit<ProposeDialogProps, 'kind' | 'onSwitch'> & { open: boolean }
) {
  const [wanted, setWanted] = useState(props.open);
  // Once opened it stays mounted, so opening it again needs no load.
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  const { open, ...rest } = props;
  return (
    <Suspense fallback={null}>
      <ProposeDialog {...rest} kind={open ? 'decline' : null} onSwitch={() => {}} />
    </Suspense>
  );
}
