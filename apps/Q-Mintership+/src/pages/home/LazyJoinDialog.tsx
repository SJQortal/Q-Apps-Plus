/**
 * The join dialog, loaded the first time it opens: the write code (guards,
 * Hub requests) stays out of Home's first load, which everyone sees.
 */
import { lazy, Suspense, useState } from 'react';
import type { JoinDialogProps } from './JoinDialog';

const JoinDialog = lazy(() => import('./JoinDialog').then((m) => ({ default: m.JoinDialog })));

export function LazyJoinDialog(props: JoinDialogProps) {
  const [wanted, setWanted] = useState(props.open);
  // Once opened it stays mounted, so closing can animate and the result can show.
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <JoinDialog {...props} />
    </Suspense>
  );
}
