/**
 * The nominee's own button, the same wherever it shows (their card on
 * Nominations, Home's hero): "Accept nomination" or "Join now" (rules in
 * nomineeStep.ts), each explained in JoinDialog before Hub opens.
 * Optimistic: "You're ready ✓ (confirming…)" from the moment Hub sends it
 * until the chain shows it; then the same words as Home's.
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { READY_DONE, READY_DONE_NEXT } from '../../constants/words';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import type { Signer } from '../../writes/runner';
import { JoinDialog } from './JoinDialog';
import { readable } from '../../utils/readable';
import { JOIN_LABEL, type JoinMode, type NomineeStep } from './nomineeStep';

function Done({ children }: { children: string }) {
  return (
    <Typography
      variant="body2"
      role="status"
      className="qmp-fade"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: readable('success') }}
    >
      <CheckCircleOutlineOutlinedIcon aria-hidden className="qmp-pop" sx={{ fontSize: 18 }} />
      {children}
    </Typography>
  );
}

export function NomineeAction({
  step,
  signer,
  needed,
  askWho,
  onDone,
}: {
  step: NomineeStep;
  signer: Signer | null;
  /** Signatures needed now, for the dialog's explanation. */
  needed?: number | null;
  /** Who nominated them: who to ask for QORT if the fee can't be paid. */
  askWho?: string | null;
  onDone?: () => void;
}) {
  const pending = usePendingWrite(signer ? writeKeys.join(signer.address) : null);
  // The dialog keeps the mode it opened with while the data refreshes under it.
  const [dialog, setDialog] = useState<{ mode: JoinMode; open: boolean } | null>(null);

  let content = null;
  if (pending && pending.status !== 'failed') {
    const joining = dialog?.mode === 'join' || step === 'join';
    content = (
      <Done>
        {pending.status === 'sending'
          ? 'Sending…'
          : joining
            ? 'Joined ✓ (confirming…)'
            : `${READY_DONE} (confirming…)`}
      </Done>
    );
  } else if (step === 'ready') {
    content = <Done>{`${READY_DONE}: ${READY_DONE_NEXT}`}</Done>;
  } else if (step === 'accept' || step === 'join') {
    const mode = step;
    content = (
      <Button
        variant="contained"
        onClick={() => setDialog({ mode, open: true })}
        sx={{ minHeight: 44 }}
      >
        {JOIN_LABEL[mode]}
      </Button>
    );
  }

  return (
    <>
      {content ? <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>{content}</Box> : null}
      {dialog ? (
        <JoinDialog
          open={dialog.open}
          mode={dialog.mode}
          signer={signer}
          needed={needed}
          askWho={askWho}
          onClose={() => setDialog((d) => (d ? { ...d, open: false } : d))}
          onSuccess={onDone}
        />
      ) : null}
    </>
  );
}
