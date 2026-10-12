/**
 * Small parts of a decision, shared by the full card (Decisions) and the
 * compact DecisionRow: the signing clock, the signers' avatars and the
 * "Signed ✓" chip.
 *
 * The clock is the shared Countdown with the signing words. The signers
 * list puts list semantics on the items, not on the links.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Link, Tooltip, Typography } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import { useDisplayName } from '../../hooks/useDisplayName';
import { Countdown } from '../common/Countdown';
import { NameAvatar } from '../common/NameAvatar';
import { personPath } from '../../routes/paths';

/** Time left to sign: until the last block in which a signature still counts. */
export function SigningClock({ now, height }: { now: ChainNow; height: number }) {
  return (
    <Countdown
      now={now}
      height={height}
      suffix="left to sign"
      doneText="Signing time is over"
      blockLabel="Last block a signature counts in:"
    />
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
