/**
 * Small parts of a decision, shared by the full card (Decisions) and the
 * compact DecisionRow: the signing clock (the shared Countdown with the
 * signing words), the "Signed ✓" chip and the admin's own answer. The
 * signers' avatars are the shared AvatarStack (components/common/Person).
 */
import { Chip } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import type { AnswerView } from '../../pages/decisions/decisionUi';
import { useChangedSinceMount } from '../../hooks/useChangedSinceMount';
import { Countdown } from '../common/Countdown';

/** Time left to sign: until the last block in which a signature still counts. */
export function SigningClock({
  now,
  height,
  plain,
  detailVisible,
}: {
  now: ChainNow;
  height: number;
  /** Inside a link: nothing extra (see Countdown). */
  plain?: boolean;
  /** The last block and its date as a visible line (see Countdown). */
  detailVisible?: boolean;
}) {
  return (
    <Countdown
      now={now}
      height={height}
      suffix="left to sign"
      doneText="Signing time is over"
      blockLabel="Last block a signature counts in:"
      plain={plain}
      detailVisible={detailVisible}
    />
  );
}

/**
 * "Signed ✓" once it is in a block (filled green), or "… (confirming…)"
 * while it is on its way: a green outline with the words in the text
 * colour, which stays readable on every theme. With `pop` it pops in
 * (index.css → .qmp-pop): when it takes the place of the button just
 * pressed, not when a page opens with it. It settles in place: the same
 * chip, recoloured.
 */
export function DoneChip({
  label,
  settled,
  size = 'medium',
  pop = false,
}: {
  label: string;
  settled: boolean;
  size?: 'small' | 'medium';
  /** It just turned up on screen: the parent's useChangedSinceMount. */
  pop?: boolean;
}) {
  const className = pop ? 'qmp-pop' : undefined;
  return settled ? (
    <Chip
      className={className}
      color="success"
      size={size}
      label={label}
      sx={{ fontWeight: 700 }}
    />
  ) : (
    <Chip
      className={className}
      variant="outlined"
      size={size}
      label={label}
      sx={{ fontWeight: 700, borderColor: 'success.main' }}
    />
  );
}

/**
 * The admin's own answer: a signature as DoneChip; a rejection (or a
 * withdrawn signature) in neutral grey, filled once it is in a block and
 * outlined while it is on its way. Nothing when there is no answer. It pops
 * in when the answer changes on screen, never for the answers a page opens
 * with, and not again as it settles.
 */
export function AnswerChip({
  view,
  size = 'medium',
}: {
  view: Pick<AnswerView, 'shown' | 'settled' | 'label'>;
  size?: 'small' | 'medium';
}) {
  const pop = useChangedSinceMount(view.shown);
  if (!view.label) return null;
  if (view.shown === 'signed')
    return <DoneChip label={view.label} settled={view.settled} size={size} pop={pop} />;
  const className = pop ? 'qmp-pop' : undefined;
  return view.settled ? (
    <Chip className={className} size={size} label={view.label} sx={{ fontWeight: 700 }} />
  ) : (
    <Chip
      className={className}
      variant="outlined"
      size={size}
      label={view.label}
      sx={{ fontWeight: 700, borderColor: 'text.secondary' }}
    />
  );
}
