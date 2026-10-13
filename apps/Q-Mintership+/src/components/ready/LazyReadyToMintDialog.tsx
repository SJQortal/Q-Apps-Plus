/**
 * The ready-to-mint dialog, loaded the first time it opens: Home uses this,
 * so the write code (guards, Hub requests) stays out of its first load,
 * which everyone sees.
 */
import { lazy, Suspense, useState } from 'react';
import type { ReadyToMintDialogProps } from './ReadyToMintDialog';

const ReadyToMintDialog = lazy(() =>
  import('./ReadyToMintDialog').then((m) => ({ default: m.ReadyToMintDialog }))
);

export function LazyReadyToMintDialog(props: ReadyToMintDialogProps) {
  const [wanted, setWanted] = useState(props.open);
  // Once opened it stays mounted, so closing can animate and the result can show.
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <ReadyToMintDialog {...props} />
    </Suspense>
  );
}
