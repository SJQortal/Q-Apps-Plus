/**
 * Where the signed-in account stands on "Show you're ready to mint", for
 * Home's heroes (ready.tsx): ready once a join request is open, or while
 * the one Hub just sent is confirming; plus the dialog's open state.
 */
import { useState } from 'react';
import type { MyStatus } from '../../../rules/status';
import { signerOf, useSession } from '../../../state/session';
import { usePendingWrite, writeKeys } from '../../../writes/optimistic';

export function useReadyToMint(status: MyStatus) {
  const signer = signerOf(useSession());
  const pending = usePendingWrite(writeKeys.join(status.address));
  const [dialogOpen, setDialogOpen] = useState(false);
  const confirming = !status.hasJoinRequest && pending?.status === 'confirming';
  return {
    signer,
    /** A join request is open, or Hub just sent one. */
    ready: status.hasJoinRequest || confirming,
    /** Hub sent it; it isn't in a block yet. */
    confirming,
    sending: pending?.status === 'sending',
    /** Hub stopped waiting and nothing turned up yet (until the join request shows). */
    unknown:
      !status.hasJoinRequest && pending?.status === 'failed'
        ? (pending.message ??
          "Your join request hasn't shown up yet. Check again in a minute before trying again.")
        : null,
    dialogOpen,
    setDialogOpen,
  };
}

export type ReadyToMint = ReturnType<typeof useReadyToMint>;
