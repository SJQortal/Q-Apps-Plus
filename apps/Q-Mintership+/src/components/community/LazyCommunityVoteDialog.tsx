/**
 * The community vote dialog, loaded the first time it opens, so the write
 * code (guards, Hub requests) stays out of the cards everyone sees.
 */
import { lazy, Suspense, useState } from 'react';
import type { CommunityVoteDialogProps } from './CommunityVoteDialog';

const CommunityVoteDialog = lazy(() =>
  import('./CommunityVoteDialog').then((m) => ({ default: m.CommunityVoteDialog }))
);

export function LazyCommunityVoteDialog(props: CommunityVoteDialogProps) {
  const [wanted, setWanted] = useState(props.open);
  // Once opened it stays mounted, so closing can animate and the result can show.
  if (props.open && !wanted) setWanted(true);
  if (!wanted) return null;
  return (
    <Suspense fallback={null}>
      <CommunityVoteDialog {...props} />
    </Suspense>
  );
}
