/**
 * "Add your support" to an open nomination: an optional short note, then one
 * Hub confirmation that publishes the support record under your name
 * (writes/flows.ts → publishSupport). It shows on the card as "also
 * supported by …", so Minter Admins see who else backs the nominee.
 */
import { useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { NOTE_MAX } from '../../data/records';
import { useDisplayName } from '../../hooks/useDisplayName';
import { publishSupport } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';

export interface SupportDialogProps {
  open: boolean;
  onClose: () => void;
  nominee: string;
  nomineeName?: string | null;
  /** The signed-in member, with the name the record is published under. */
  signer: (Signer & { name: string }) | null;
  onSuccess?: () => void;
}

export function SupportDialog({
  open,
  onClose,
  nominee,
  nomineeName,
  signer,
  onSuccess,
}: SupportDialogProps) {
  const [note, setNote] = useState('');
  const who = useDisplayName(nominee, nomineeName).label;
  const trimmed = note.trim();

  return (
    <HubStepDialog
      open={open}
      onClose={onClose}
      title="Add your support"
      confirmLabel="Continue to Hub"
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography>
            Your support shows on the nomination of <strong>{who}</strong> as “also supported by{' '}
            {signer?.name ?? 'you'}”. It tells the Minter Admins that more than one experienced
            minter backs them.
          </Typography>
          <TextField
            label="A note (optional)"
            placeholder="What have you seen them do?"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            helperText={`${trimmed.length} / ${NOTE_MAX}`}
            slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
          />
          <Typography variant="body2" color="text.secondary">
            It is published as a small public record under your name on QDN. Nothing else is sent.
          </Typography>
        </Box>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: 'Publish your support',
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => {
        if (!signer) {
          return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        }
        const outcome = await publishSupport(signer, nominee, trimmed || undefined, (stage) =>
          report(0, stage)
        );
        return { outcome };
      }}
      successTitle="Support published"
      successText={
        <Typography variant="body2">
          It shows on the nomination once QDN has it, usually within a minute or two.
        </Typography>
      }
      onSuccess={() => {
        setNote('');
        onSuccess?.();
      }}
    />
  );
}
