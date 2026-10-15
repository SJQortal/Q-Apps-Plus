/**
 * Considering ("I've looked at this, not sure yet") on the cards: the
 * admin's own button (who is considering shows in AnswerColumns). It
 * changes nothing on chain: a small QDN record under the admin's name, 0.01
 * QORT per update, stated before Hub opens. The dialog that publishes it is
 * ConsideringDialog.tsx, apart so these light parts don't bring the write
 * code along.
 */
import { Button, Chip } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import type { ConsideringTarget } from '../../data/records';
import type { MyConsideringState } from '../../rules/considering';

/**
 * The admin's own Considering: a button, or "Considering" with "No longer
 * considering" once they are. `label` names the card for screen readers.
 * An admin whose latest answer is a rejection gets "Reconsidering" (`again`).
 */
export function ConsideringControls({
  mine,
  label,
  canStart,
  again = false,
  onSet,
  onClear,
}: {
  mine: MyConsideringState;
  label: string;
  /**
   * Considering can be started: the admin hasn't answered, or their latest
   * answer is a rejection in a block, and it can still count.
   */
  canStart: boolean;
  /** Their latest answer is a rejection: the button says "Reconsidering". */
  again?: boolean;
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
  const word = again ? 'Reconsidering' : 'Considering';
  return (
    <Button
      variant="text"
      color="inherit"
      onClick={onSet}
      disabled={mine.busy}
      startIcon={<VisibilityOutlinedIcon aria-hidden />}
      aria-label={`${word}: ${label}`}
      sx={{ minHeight: 44 }}
    >
      {word}
    </Button>
  );
}

export interface ConsideringRequest {
  target: ConsideringTarget;
  mode: 'set' | 'clear';
  /** What it is about, e.g. "Add to MINTER: bob+builder". */
  label: string;
  /** It is about a nominee: a waiting nomination or an invite. */
  nominee?: boolean;
  /** The admin's latest answer is a rejection: they are reconsidering it. */
  again?: boolean;
}
