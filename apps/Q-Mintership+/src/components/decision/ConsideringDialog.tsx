/**
 * The dialog that publishes Considering (with an optional note), or "No
 * longer considering": a small QDN record under the admin's name, 0.01 QORT
 * per update, stated before Hub opens. Apart from Considering.tsx so the
 * cards that only show who is considering don't load the write code.
 */
import { useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { NOTE_MAX } from '../../data/records';
import { publishConsidering } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';
import type { ConsideringRequest } from './Considering';

/** Publish Considering (with an optional note), or "No longer considering". */
export function ConsideringDialog({
  request,
  signer,
  onClose,
}: {
  request: ConsideringRequest | null;
  signer: (Signer & { name: string | null }) | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  // A note belongs to one decision or nomination: start empty when the target
  // changes (adjust-while-rendering, like HubStepDialog's reset on open). The
  // same target again, after "Not now" or a cancel in Hub, keeps the draft.
  const targetKey = request
    ? 'pendingSignature' in request.target
      ? request.target.pendingSignature
      : request.target.nomineeAddress
    : null;
  const [noteFor, setNoteFor] = useState<string | null>(targetKey);
  if (targetKey !== null && targetKey !== noteFor) {
    setNoteFor(targetKey);
    setNote('');
  }
  const trimmed = note.trim();
  const clear = request?.mode === 'clear';
  return (
    <HubStepDialog
      open={Boolean(request && signer)}
      onClose={onClose}
      title={clear ? 'No longer considering' : 'Mark as considering'}
      intro={
        request ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {request.label}
            </Typography>
            {clear ? (
              <Typography>
                This publishes your Considering record again, marked as no longer considering: QDN
                can’t delete a record. It changes nothing on chain.
              </Typography>
            ) : (
              <>
                <Typography>
                  Tell the other Minter Admins{request.nominee ? ', and the nominee,' : ''} that
                  you’ve looked at this and haven’t decided yet. It changes nothing on chain.
                </Typography>
                <TextField
                  label="A note (optional)"
                  placeholder="What are you waiting for?"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                  multiline
                  minRows={2}
                  maxRows={6}
                  fullWidth
                  helperText={`Everyone can read it. ${trimmed.length} / ${NOTE_MAX}`}
                  slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
                />
                <Typography variant="body2" color="text.secondary">
                  It is a small public record under your name ({signer?.name ?? 'none yet'}) on QDN.
                  Signing, rejecting or withdrawing later replaces it, and you can say you’re no
                  longer considering at any time.
                </Typography>
              </>
            )}
          </Box>
        ) : null
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: clear ? 'Publish the update' : 'Publish that you’re considering',
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => {
        if (!request || !signer)
          return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        const outcome = await publishConsidering(
          signer,
          request.target,
          clear ? { cleared: true } : { note: trimmed || undefined },
          (stage) => report(0, stage)
        );
        return { outcome };
      }}
      successTitle={clear ? 'Updated' : 'Marked as considering'}
      successText={
        <Typography variant="body2">
          It shows on the card once QDN has it, usually within a minute or two.
        </Typography>
      }
      onSuccess={() => setNote('')}
    />
  );
}
