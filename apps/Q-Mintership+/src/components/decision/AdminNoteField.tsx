/**
 * The optional "Note for the Minter Admins" on a proposal or a nomination a
 * Minter Admin makes (Simon, 2026-10-18: an extra description encrypted to
 * the Minter Admins only), and how it reads in the review before Hub opens.
 * The Hub step that publishes it is adminNoteStep.tsx.
 */
import type { ReactNode } from 'react';
import { TextField, Typography } from '@mui/material';
import { ADMIN_NOTE_MAX, normaliseNoteText } from '../../data/adminNoteRecords';
import { formatCount, plural } from '../../utils/format';

export function AdminNoteField({
  value,
  onChange,
  name,
  admins,
}: {
  value: string;
  onChange: (text: string) => void;
  /** The writer's registered name (the note goes under it); null: none, so no note. */
  name: string | null;
  /** How many Minter Admins it is encrypted to (0: not known here). */
  admins: number;
}) {
  if (!name)
    return (
      <Typography variant="body2" color="text.secondary">
        A note for the Minter Admins is published under your registered name, and your account has
        none yet.
      </Typography>
    );
  return (
    <TextField
      label="Note for the Minter Admins (optional)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      multiline
      minRows={2}
      maxRows={8}
      fullWidth
      helperText={`Encrypted to ${admins > 0 ? `the ${plural(admins, 'Minter Admin')}` : 'the Minter Admins'}: only they can read it. ${formatCount(normaliseNoteText(value).length)} / ${formatCount(ADMIN_NOTE_MAX)}`}
      slotProps={{ htmlInput: { maxLength: ADMIN_NOTE_MAX } }}
    />
  );
}

/** The note, in the review before Hub opens. */
export function AdminNoteReview({ text }: { text: string }): ReactNode {
  const clean = normaliseNoteText(text);
  if (!clean) return null;
  return (
    <Typography sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
      <b>Note for the Minter Admins (encrypted):</b> {clean}
    </Typography>
  );
}
