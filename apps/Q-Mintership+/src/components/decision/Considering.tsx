/**
 * Considering ("I've looked at this, not sure yet") on the cards: who is
 * considering (with their notes) next to the signers, the count on
 * nomination cards and the admin's own button. It changes nothing on chain:
 * a small QDN record under the admin's name, 0.01 QORT per update, stated
 * before Hub opens. The dialog that publishes it is ConsideringDialog.tsx,
 * apart so these light parts don't bring the write code along.
 */
import { Button, Chip, Typography } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import type { ConsideringTarget } from '../../data/records';
import {
  consideringCountText,
  type ConsideringPerson,
  type MyConsideringState,
} from '../../rules/considering';
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
