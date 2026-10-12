/**
 * Small parts of a decision, shared by the full card (Decisions) and the
 * compact DecisionRow: the signing clock, the signers' avatars and the
 * "Signed ✓" chip.
 *
 * The clock is the shared Countdown's maths with readable colours: the icon
 * shifts calm → soon → urgent, and the time itself stays in the text colour
 * (red when urgent), because the "soon" orange is too faint on light themes.
 * The signers list puts list semantics on the items, not on the links.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Link, Tooltip, Typography } from '@mui/material';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useAtomValue } from 'jotai';
import type { ChainNow } from '../../data/chain';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useNow } from '../../hooks/useNow';
import { NameAvatar } from '../common/NameAvatar';
import { personPath } from '../../routes/paths';
import { timeDisplayAtom } from '../../state/settings';
import { formatCount, formatCountdown, formatDateTime } from '../../utils/format';
import { urgencyOf, type Urgency } from '../../utils/urgency';

const ICON_TONE: Record<Urgency, string> = {
  calm: 'success.main',
  soon: 'warning.main',
  urgent: 'error.main',
  over: 'text.secondary',
};

/** Time left to sign: until the last block in which a signature still counts. */
export function SigningClock({ now, height }: { now: ChainNow; height: number }) {
  const clock = useNow(1000);
  const display = useAtomValue(timeDisplayAtom);
  const blocks = Math.max(0, height - now.height);
  const target = now.timestamp + blocks * now.msPerBlock;
  const msLeft = Math.max(0, target - clock);
  const urgency: Urgency = blocks === 0 ? 'over' : urgencyOf(msLeft);
  const time = formatCountdown(msLeft);
  const blockText = `${formatCount(blocks)} block${blocks === 1 ? '' : 's'}`;
  const main =
    urgency === 'over'
      ? 'Signing time is over'
      : display === 'blocks'
        ? blockText
        : display === 'both'
          ? `${time} · ${blockText}`
          : time;
  const detail = `Last block a signature counts in: ${formatCount(height)}, about ${formatDateTime(target)}${now.estimated ? ' (block time estimated)' : ''}`;
  return (
    <Tooltip title={detail}>
      <Box
        component="span"
        aria-label={urgency === 'over' ? main : `${time} left to sign, ${blockText}. ${detail}`}
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
            fontVariantNumeric: 'tabular-nums',
            color:
              urgency === 'urgent'
                ? 'error.main'
                : urgency === 'over'
                  ? 'text.secondary'
                  : 'text.primary',
          }}
        >
          {main}
        </Typography>
        {urgency !== 'over' ? (
          <Typography component="span" variant="body2" color="text.secondary">
            left to sign
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  );
}

/** The signers' avatars, each linking to the person, the rest counted. */
export function SignerAvatars({
  people,
  label,
  max = 10,
}: {
  people: Array<{ address: string; name?: string | null }>;
  label: string;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <Box
      component="ul"
      aria-label={label}
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
    >
      {shown.map((p) => (
        <Box component="li" key={p.address} sx={{ display: 'flex' }}>
          <Signer address={p.address} name={p.name} />
        </Box>
      ))}
      {rest > 0 ? (
        <Box component="li" sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            +{rest}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function Signer({ address, name }: { address: string; name?: string | null }) {
  const shown = useDisplayName(address, name);
  return (
    <Tooltip title={shown.label}>
      <Link
        component={RouterLink}
        to={personPath(address)}
        aria-label={shown.label}
        sx={{ display: 'inline-flex', borderRadius: '50%' }}
      >
        <NameAvatar name={shown.name} size={28} />
      </Link>
    </Tooltip>
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
