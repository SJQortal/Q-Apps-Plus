/**
 * Small parts of a decision, shared by the full card (Decisions) and the
 * compact DecisionRow: the signing clock (the shared Countdown with the
 * signing words) and the "Signed ✓" chip. The signers' avatars are the
 * shared AvatarStack (components/common/Person).
 */
import { Chip } from '@mui/material';
import type { ChainNow } from '../../data/chain';
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
 * colour, which stays readable on every theme.
 */
export function DoneChip({
  label,
  settled,
  size = 'medium',
}: {
  label: string;
  settled: boolean;
  size?: 'small' | 'medium';
}) {
  return settled ? (
    <Chip color="success" size={size} label={label} sx={{ fontWeight: 700 }} />
  ) : (
    <Chip
      variant="outlined"
      size={size}
      label={label}
      sx={{ fontWeight: 700, borderColor: 'success.main' }}
    />
  );
}
