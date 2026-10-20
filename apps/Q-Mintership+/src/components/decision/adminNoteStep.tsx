/**
 * The note for the Minter Admins as one more Hub step once the proposal (or
 * nomination) is in: ProposeSignDialog's `followUp`, or the nomination's
 * second step (writes/adminNotes.ts → publishAdminNote).
 */
import { Typography } from '@mui/material';
import { ADMIN_NOTE_PREFIX, normaliseNoteText } from '../../data/adminNoteRecords';
import { decisionCommentKey } from '../../data/commentRecords';
import { publishAdminNote, type AdminWriter } from '../../writes/adminNotes';
import type { WriteOutcome, WriteStage } from '../../writes/runner';
import type { HubStep } from '../common/HubStepDialog';
import { encryptedCheck } from '../common/encryptedWords';

export interface NoteFollowUp {
  step: HubStep;
  run: (key: string, onStage: (stage: WriteStage) => void) => Promise<WriteOutcome>;
  /** What to do when it didn't go through. */
  later: string;
}

/**
 * The note as one more Hub step; null when nothing is written or there is
 * no name to publish it under.
 * `keyOf` turns what the step before made into the note's key (a
 * proposal's signature by default).
 */
export function adminNoteFollowUp(
  writer: AdminWriter | null,
  note: string,
  keyOf: (made: string) => string = decisionCommentKey
): NoteFollowUp | null {
  const text = normaliseNoteText(note);
  if (!writer?.name || !text) return null;
  return {
    step: {
      action: 'PUBLISH_QDN_RESOURCE',
      title: 'Add your note for the Minter Admins, encrypted',
      detail: (
        <Typography variant="body2">
          Hub shows a record published under {writer.name}, encrypted: only the Minter Admins can
          read it.
        </Typography>
      ),
      check: encryptedCheck(writer.name, ADMIN_NOTE_PREFIX),
      feeTxType: 'ARBITRARY',
    },
    run: async (made, onStage) =>
      (await publishAdminNote(writer, keyOf(made), text, {}, onStage)).outcome,
    later: 'You can still add the note from its card in Decisions.',
  };
}
