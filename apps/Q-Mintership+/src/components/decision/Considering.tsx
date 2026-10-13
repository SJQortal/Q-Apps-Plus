/**
 * Considering ("I've looked at this, not sure yet") on the cards: who is
 * considering (with their notes) next to the signers, the count on
 * nomination cards, the admin's own button, and the dialog that publishes
 * it. It changes nothing on chain: a small QDN record under the admin's
 * name, 0.01 QORT per update, stated before Hub opens.
 */
import { useState } from 'react';
import { Box, Button, Chip, TextField, Typography } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { NOTE_MAX, type ConsideringTarget } from '../../data/records';
import {
  consideringCountText,
  type ConsideringPerson,
  type MyConsideringState,
} from '../../rules/considering';
import { publishConsidering } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';
import { PersonInline } from '../common/Person';

/** "Considering: Admin K (“note”), Admin L": who, with their notes, next to the signers. */
export function ConsideringLine({ people }: { people: ConsideringPerson[] }) {
  if (!people.length) return null;
  return (
    <Typography
      component="div"
      variant="body2"
      color="text.secondary"
      sx={{ overflowWrap: 'anywhere' }}
    >
      Considering:{' '}
      {people.map((p, i) => (
        <span key={p.address}>
          {i > 0 ? ', ' : ''}
          <PersonInline address={p.address} name={p.name} />
          {p.note ? <> (“{p.note}”)</> : null}
        </span>
      ))}
    </Typography>
  );
}

/** "3 Minter Admins are considering", for nomination cards and the nominee's Home. */
export function ConsideringCount({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <VisibilityOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
      {consideringCountText(count)}
    </Typography>
  );
}

/**
 * The admin's own Considering: a button, or "Considering" with "No longer
 * considering" once they are. `label` names the card for screen readers.
 */
export function ConsideringControls({
  mine,
  label,
  canStart,
  onSet,
  onClear,
}: {
  mine: MyConsideringState;
  label: string;
  /** Considering can be started (the admin hasn't answered, and it can still count). */
  canStart: boolean;
  onSet: () => void;
  onClear: () => void;
}) {
  if (mine.sending) {
    return (
      <Button variant="text" disabled sx={{ minHeight: 44 }}>
        Publishing…
      </Button>
    );
  }
  if (mine.considering) {
    return (
      <>
        <Chip
          variant="outlined"
          label={mine.settled ? 'Considering' : 'Considering (publishing…)'}
          icon={<VisibilityOutlinedIcon aria-hidden />}
          sx={{ fontWeight: 700, borderColor: 'text.secondary' }}
        />
        <Button
          variant="text"
          color="inherit"
          onClick={onClear}
          disabled={mine.busy}
          aria-label={`No longer considering: ${label}`}
          sx={{ minHeight: 44 }}
        >
          No longer considering
        </Button>
      </>
    );
  }
  if (!canStart) return null;
  return (
    <Button
      variant="text"
      color="inherit"
      onClick={onSet}
      disabled={mine.busy}
      startIcon={<VisibilityOutlinedIcon aria-hidden />}
      aria-label={`Considering: ${label}`}
      sx={{ minHeight: 44 }}
    >
      Considering
    </Button>
  );
}

export interface ConsideringRequest {
  target: ConsideringTarget;
  mode: 'set' | 'clear';
  /** What it is about, e.g. "Add to MINTER: bob+builder". */
  label: string;
}

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
                  Tell the other Minter Admins, and the nominee, that you’ve looked at this and
                  haven’t decided yet. It changes nothing on chain.
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
