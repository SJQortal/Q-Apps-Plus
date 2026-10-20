/**
 * Add or edit the note for the Minter Admins on one's own decision or
 * nomination (writes/adminNotes.ts): the words, then one Hub step that
 * publishes them encrypted to the Minter Admins (0.01 QORT), explained
 * before Hub opens. Apart from AdminNote.tsx so cards that only show a note
 * don't load the write code.
 */
import { useRef, useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import {
  ADMIN_NOTE_MAX,
  ADMIN_NOTE_PREFIX,
  adminNoteTextProblems,
  normaliseNoteText,
} from '../../data/adminNoteRecords';
import { formatCount } from '../../utils/format';
import { publishAdminNote, type AdminWriter } from '../../writes/adminNotes';
import { encryptedCheck, encryptedTo } from '../common/encryptedWords';
import { HubStepDialog } from '../common/HubStepDialog';

export interface AdminNoteRequest {
  /** The key it goes under (a decision's, or a nominee's address). */
  noteKey: string;
  /** What it is on, for the title: "Remove a member: Kai Target". */
  label: string;
  /** The note as it reads now (an edit). */
  text?: string;
}

export function AdminNoteDialog({
  request,
  writer,
  admins,
  onClose,
  returnFocus,
}: {
  request: AdminNoteRequest | null;
  writer: AdminWriter | null;
  /** How many Minter Admins it is encrypted to. */
  admins: number;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);
  // Each request starts from its own words (adjust-while-rendering).
  const forKey = request ? `${request.noteKey}:${request.text ?? ''}` : null;
  const [shownFor, setShownFor] = useState<string | null>(null);
  if (forKey !== null && forKey !== shownFor) {
    setShownFor(forKey);
    setText(request?.text ?? '');
    setTouched(false);
  }
  const editing = Boolean(request?.text);
  const problem = adminNoteTextProblems(text)[0] ?? null;
  const same = editing && normaliseNoteText(text) === normaliseNoteText(request?.text ?? '');
  const error = touched ? (same ? 'Change something first.' : problem) : null;
  return (
    <HubStepDialog
      open={Boolean(request && writer)}
      onClose={onClose}
      returnFocus={returnFocus}
      title={editing ? 'Edit your note for the Minter Admins' : 'Add a note for the Minter Admins'}
      intro={
        request ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {request.label}
            </Typography>
            <TextField
              label="Note for the Minter Admins"
              value={text}
              inputRef={field}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => setTouched(true)}
              error={Boolean(error)}
              helperText={
                error ??
                `Only the Minter Admins can read it. ${formatCount(normaliseNoteText(text).length)} / ${formatCount(ADMIN_NOTE_MAX)}`
              }
              multiline
              minRows={3}
              maxRows={10}
              fullWidth
              slotProps={{ htmlInput: { maxLength: ADMIN_NOTE_MAX } }}
            />
            <Typography variant="body2" color="text.secondary">
              {editing
                ? 'The new version replaces your note, marked “edited”.'
                : 'It shows under the public reason, for the Minter Admins only.'}{' '}
              {encryptedTo(admins)}
            </Typography>
          </Box>
        ) : null
      }
      beforeStart={() => {
        setTouched(true);
        if (problem || same) {
          field.current?.focus();
          return false;
        }
        return true;
      }}
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: 'Publish your note, encrypted',
          check: encryptedCheck(writer?.name ?? '', ADMIN_NOTE_PREFIX),
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => {
        if (!request || !writer)
          return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        const { outcome } = await publishAdminNote(
          writer,
          request.noteKey,
          text,
          { edited: editing },
          (stage) => report(0, stage)
        );
        return { outcome };
      }}
      successTitle={editing ? 'Note updated' : 'Note added'}
      successText={
        <Typography variant="body2">
          It shows here now, and for the other Minter Admins once QDN has it, usually within a
          minute or two.
        </Typography>
      }
    />
  );
}
