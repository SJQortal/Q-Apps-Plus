/**
 * A live countdown to a block height: time left at the measured block pace
 * (and/or blocks left, per Settings), shifting colour as time runs out.
 * Re-renders once a second from one shared timer (hooks/useNow).
 *
 * The icon carries the urgency colour (calm → soon → urgent); the time is
 * text, so it takes the readable shade of that colour (utils/readable), and
 * stays in the text colour while there is plenty of time.
 */
import { Box, Tooltip, Typography } from '@mui/material';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useAtomValue } from 'jotai';
import type { ChainNow } from '../../data/chain';
import { useNow } from '../../hooks/useNow';
import { timeDisplayAtom } from '../../state/settings';
import { formatCount, formatCountdown, formatDateTime } from '../../utils/format';
import { readable } from '../../utils/readable';
import { urgencyOf, type Urgency } from '../../utils/urgency';

const ICON_TONE: Record<Urgency, string> = {
  calm: 'success.main',
  soon: 'warning.main',
  urgent: 'error.main',
  over: 'text.secondary',
};

const TEXT_TONE: Record<Urgency, string | ReturnType<typeof readable>> = {
  calm: 'text.primary',
  soon: readable('warning'),
  urgent: readable('error'),
  over: 'text.secondary',
};

export interface CountdownProps {
  now: ChainNow;
  /** The block the countdown runs to. */
  height: number;
  /** "left to sign", "until it expires". */
  suffix?: string;
  /** Text once the block is reached. */
  doneText?: string;
  /** How the tooltip names the block: "Block", "Last block a signature counts in:". */
  blockLabel?: string;
  /**
   * Inside a link: no label of its own, so the link's name is the visible
   * words ("6d 12h left to sign"); the block and date stay in the tooltip.
   */
  plain?: boolean;
}

export function Countdown({
  now,
  height,
  suffix = 'left',
  doneText = 'Time is up',
  blockLabel = 'Block',
  plain = false,
}: CountdownProps) {
  const clock = useNow(1000);
  const display = useAtomValue(timeDisplayAtom);
  const blocks = Math.max(0, height - now.height);
  // Time from the tip block's timestamp, ticking down with the wall clock.
  const target = now.timestamp + blocks * now.msPerBlock;
  const msLeft = Math.max(0, target - clock);
  const urgency = blocks === 0 ? 'over' : urgencyOf(msLeft);
  const time = formatCountdown(msLeft);
  const blockText = `${formatCount(blocks)} block${blocks === 1 ? '' : 's'}`;
  const main =
    urgency === 'over'
      ? doneText
      : display === 'blocks'
        ? blockText
        : display === 'both'
          ? `${time} · ${blockText}`
          : time;
  const detail = `${blockLabel} ${formatCount(height)}, about ${formatDateTime(target)}${now.estimated ? ' (block time estimated)' : ''}`;

  return (
    <Tooltip title={detail} describeChild={plain}>
      <Box
        component="span"
        aria-label={
          plain
            ? undefined
            : urgency === 'over'
              ? doneText
              : `${time} ${suffix}, ${blockText}. ${detail}`
        }
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
      >
        <ScheduleOutlinedIcon
          aria-hidden
          sx={{ fontSize: 18, color: ICON_TONE[urgency], transition: 'color 400ms ease' }}
        />
        <Typography
          component="span"
          variant="body2"
          sx={{
            fontWeight: 700,
            color: TEXT_TONE[urgency],
            fontVariantNumeric: 'tabular-nums',
            transition: 'color 400ms ease',
          }}
        >
          {main}
        </Typography>
        {/* A space for screen readers; the flex row ignores it. */}{' '}
        {urgency !== 'over' ? (
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
            {suffix}
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  );
}
