/**
 * The nominee's own button, the same wherever it shows (their card on
 * Nominations, Home's hero): "Accept nomination" or "Join now" (rules in
 * nomineeStep.ts), each explained in JoinDialog before Hub opens.
 * Optimistic: "Accepted ✓ (confirming…)" from the moment Hub sends it
 * until the chain shows it.
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import type { Signer } from '../../writes/runner';
import { JoinDialog } from './JoinDialog';
import { successText } from './tone';
import { JOIN_LABEL, type JoinMode, type NomineeStep } from './nomineeStep';

function Done({ children }: { children: string }) {
  return (
    <Typography
      variant="body2"
      role="status"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: successText }}
    >
      <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
      {children}
    </Typography>
  );
}

export function NomineeAction({
  step,
  signer,
  onDone,
}: {
  step: NomineeStep;
  signer: Signer | null;
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
            : 'Accepted ✓ (confirming…)'}
      </Done>
    );
  } else if (step === 'accepted') {
    content = <Done>You accepted: approval makes you a member at once.</Done>;
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
          onClose={() => setDialog((d) => (d ? { ...d, open: false } : d))}
          onSuccess={onDone}
        />
      ) : null}
    </>
  );
}
