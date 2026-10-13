/** Page building blocks: titled sections, cards, stat tiles, chips. */
import type { ReactNode } from 'react';
import { Box, Chip, Typography, type ChipProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { NominationState } from '../../rules/nomination';
import type { DecisionPhase } from '../../rules/decision';
import { readable, type Tone } from '../../utils/readable';

export const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: theme.spacing(0, 0.5),
}));

/**
 * A titled section: small uppercase title, optional action on the right.
 * What arrives in it fades in (its data in place of a skeleton, a list's
 * first rows one after another; index.css → .qmp-reveal-fade).
 */
export function Section({
  title,
  action,
  children,
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      className="qmp-reveal-fade"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 32 }}>
        <SectionTitle id={headingId} variant="h2">
          {title}
        </SectionTitle>
        {action ? <Box sx={{ ml: 'auto' }}>{action}</Box> : null}
      </Box>
      {children}
    </Box>
  );
}

export const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  minWidth: 0,
  [theme.breakpoints.down('sm')]: { padding: theme.spacing(1.5) },
}));

/** A number with a label, for summaries ("629 members"). */
export function StatTile({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography
        sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Card>
  );
}

/**
 * A status chip in a theme colour. Filled chips take the palette's
 * contrastText (4.5:1 in every theme); outlined ones show their words in the
 * readable shade of the colour (utils/readable), since the plain accent can
 * be too faint as small text on light surfaces.
 */
export function ToneChip({ color = 'default', variant = 'filled', sx, ...rest }: ChipProps) {
  const tone = color === 'default' ? null : (color as Tone);
  return (
    <Chip
      color={color}
      variant={variant}
      sx={[
        tone && variant === 'outlined' ? { color: readable(tone) } : {},
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    />
  );
}

/** "Level 6". */
export function LevelBadge({ level }: { level: number }) {
  return <Chip size="small" label={`Level ${level}`} variant="outlined" sx={{ fontWeight: 600 }} />;
}

const NOMINATION_CHIP: Record<NominationState, { label: string; color: ChipProps['color'] }> = {
  waiting: { label: 'Waiting for a Minter Admin', color: 'default' },
  signing: { label: 'Collecting signatures', color: 'primary' },
  approved: { label: 'Approved: join to finish', color: 'success' },
  joined: { label: 'In MINTER', color: 'success' },
  expired: { label: 'Expired', color: 'default' },
  rejected: { label: 'Rejected', color: 'error' },
  lapsed: { label: 'No admin signed in time', color: 'default' },
  blocked: { label: 'Banned: ban must be lifted', color: 'warning' },
};

export function NominationStateChip({ state }: { state: NominationState }) {
  const chip = NOMINATION_CHIP[state];
  return (
    <ToneChip
      size="small"
      label={chip.label}
      color={chip.color}
      variant={chip.color === 'default' ? 'outlined' : 'filled'}
    />
  );
}

const PHASE_CHIP: Record<DecisionPhase, { label: string; color: ChipProps['color'] }> = {
  unconfirmed: { label: 'Waiting for a block', color: 'default' },
  early: { label: 'Collecting signatures', color: 'primary' },
  open: { label: 'Collecting signatures', color: 'primary' },
  thresholdMet: { label: 'Enough signatures', color: 'success' },
  rejectedMet: { label: 'Enough rejections', color: 'error' },
  tooLate: { label: 'Too late to sign', color: 'default' },
  expired: { label: 'Expired', color: 'default' },
};

export function DecisionPhaseChip({ phase }: { phase: DecisionPhase }) {
  const chip = PHASE_CHIP[phase];
  return (
    <ToneChip
      size="small"
      label={chip.label}
      color={chip.color}
      variant={chip.color === 'default' ? 'outlined' : 'filled'}
    />
  );
}
