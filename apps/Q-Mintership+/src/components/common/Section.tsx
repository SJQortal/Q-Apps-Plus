/** Page building blocks: titled sections, cards, stat tiles, chips. */
import { useLayoutEffect, useRef, type AnimationEvent, type ReactNode } from 'react';
import { Box, Chip, Typography, type ChipProps } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import type { NominationState } from '../../rules/nomination';
import type { DecisionPhase } from '../../rules/decision';
import { formatCount } from '../../utils/format';
import { readable, type Tone } from '../../utils/readable';
import { ExplainTip } from './ExplainTip';
import {
  DECISION_PHASE_EXPLANATION,
  levelExplanation,
  NOMINATION_STATE_EXPLANATION,
} from '../../constants/chipExplanations';

export const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: theme.spacing(0, 0.5),
}));

/**
 * Marks what has faded in, so it stays still from then on (index.css →
 * .qmp-reveal-fade). Without it, a row or card React moves (a re-sort, a
 * search, a row above it leaving) would fade in again: React moves an
 * element by taking it out and putting it back, and a row that moves up
 * into a list's first six starts to match their rule. Only what React adds
 * is unmarked, so new content, like data in place of a skeleton, still
 * fades in. React leaves these attributes alone: it never set them.
 */
function markShown(event: AnimationEvent<HTMLElement>) {
  if (event.animationName !== 'qmp-fade-in') return;
  const section = event.currentTarget;
  const el = event.target as HTMLElement;
  const list = el.parentElement;
  if (list === section) {
    el.dataset.qmpShown = '';
    markLater(section);
  } else if (el.tagName === 'LI' && list?.tagName === 'UL' && list.parentElement === section) {
    el.dataset.qmpShown = '';
    // Once its first rows are in, the list has arrived: none of its rows fade in again.
    if (!list.querySelector(':scope > li:nth-child(-n + 6):not([data-qmp-shown])')) {
      list.dataset.qmpRowsShown = '';
    }
  }
}

/**
 * Only a section's first eight children fade in (index.css); the rest
 * arrive with them. Marking those as shown keeps them still when one moves
 * up into the first eight (a card above it leaving).
 */
function markLater(section: HTMLElement) {
  for (const el of section.querySelectorAll<HTMLElement>(
    ':scope > :nth-child(n + 9):not([data-qmp-shown])'
  )) {
    el.dataset.qmpShown = '';
  }
}

/**
 * A titled section: small uppercase title, optional action on the right.
 * What arrives in it fades in once (its data in place of a skeleton, a
 * list's first rows one after another; index.css → .qmp-reveal-fade), and
 * stays still when it is re-sorted or filtered (markShown).
 *
 * With an `accent` (a theme colour, e.g. Decisions' sectionAccents.ts) it is
 * a panel of its own: lightly tinted in that colour, softly edged in it on
 * the left, its cards outlined in it, under a larger title with the icon in
 * the colour and the count in a pill. Its text stays the theme's text colour. On phones the panel reaches
 * a little into the page's margin, so the cards in it lose almost no width.
 */
export function Section({
  title,
  action,
  children,
  id,
  accent,
  icon,
  count,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  /** A colour from the theme: the section becomes a tinted panel with a larger title. */
  accent?: string;
  /** Shown before an accented title, in the accent. */
  icon?: ReactNode;
  /** Shown after an accented title, in a pill; screen readers hear "Title · 4". */
  count?: number;
}) {
  const headingId = id ? `${id}-title` : undefined;
  const ref = useRef<HTMLElement>(null);
  // Before the browser paints: cards past the eighth never start to fade in.
  useLayoutEffect(() => {
    if (ref.current) markLater(ref.current);
  });
  return (
    <Box
      ref={ref}
      component="section"
      aria-labelledby={headingId}
      className="qmp-reveal-fade"
      onAnimationEnd={markShown}
      sx={[
        { display: 'flex', flexDirection: 'column', gap: 1 },
        accent
          ? (theme) => ({
              gap: 1.25,
              mx: { xs: -1, sm: 0 },
              p: { xs: 1, sm: 1.5 },
              borderRadius: `${theme.shape.borderRadius}px`,
              bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.09 : 0.07),
              border: `1px solid ${alpha(accent, 0.32)}`,
              // A softer edge on the left (Simon, 2026-10-16), in the section's colour.
              borderLeft: `3px solid ${alpha(accent, 0.6)}`,
              // Its cards outlined in its colour, so cards of the same kind read apart.
              '& > article, & > [data-card]': {
                borderColor: alpha(accent, theme.palette.mode === 'dark' ? 0.5 : 0.45),
              },
            })
          : null,
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: accent ? 36 : 32 }}>
        {accent ? (
          <>
            {icon ? (
              <Box
                aria-hidden
                sx={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(accent, 0.2),
                  color: accent,
                  '& svg': { fontSize: 20 },
                }}
              >
                {icon}
              </Box>
            ) : null}
            <Typography
              component="h2"
              id={headingId}
              sx={{ fontSize: { xs: 16, sm: 17 }, fontWeight: 700, lineHeight: 1.3, minWidth: 0 }}
            >
              {title}
              {count !== undefined ? (
                <>
                  {' '}
                  <Box component="span" sx={visuallyHidden}>
                    ·
                  </Box>{' '}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      px: 1,
                      minWidth: 28,
                      borderRadius: 999,
                      textAlign: 'center',
                      fontSize: 14,
                      lineHeight: '24px',
                      verticalAlign: 'text-bottom',
                      bgcolor: alpha(accent, 0.22),
                    }}
                  >
                    {formatCount(count)}
                  </Box>
                </>
              ) : null}
            </Typography>
          </>
        ) : (
          <SectionTitle id={headingId} variant="h2">
            {title}
            {count !== undefined ? ` · ${formatCount(count)}` : null}
          </SectionTitle>
        )}
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
/**
 * A level as a chip. `explained`: what the level means, on hover, a tap or
 * focus (a person's own header; lists leave it out).
 */
export function LevelBadge({ level, explained = false }: { level: number; explained?: boolean }) {
  const chip = (
    <Chip size="small" label={`Level ${level}`} variant="outlined" sx={{ fontWeight: 600 }} />
  );
  return explained ? (
    <ExplainTip text={levelExplanation(level)} focusable>
      {chip}
    </ExplainTip>
  ) : (
    chip
  );
}

const NOMINATION_CHIP: Record<NominationState, { label: string; color: ChipProps['color'] }> = {
  waiting: { label: 'Waiting for a Minter Admin', color: 'default' },
  signing: { label: 'Collecting approvals', color: 'primary' },
  approved: { label: 'Approved: join to finish', color: 'success' },
  joined: { label: 'In MINTER', color: 'success' },
  expired: { label: 'Expired', color: 'default' },
  rejected: { label: 'Rejected', color: 'error' },
  lapsed: { label: 'No admin approved in time', color: 'default' },
  blocked: { label: 'Banned: ban must be lifted', color: 'warning' },
};

/** A nomination's state; what it means on hover or a tap (and focus, with `focusable`). */
export function NominationStateChip({
  state,
  focusable = false,
}: {
  state: NominationState;
  focusable?: boolean;
}) {
  const chip = NOMINATION_CHIP[state];
  return (
    <ExplainTip text={NOMINATION_STATE_EXPLANATION[state]} focusable={focusable}>
      <ToneChip
        size="small"
        label={chip.label}
        color={chip.color}
        variant={chip.color === 'default' ? 'outlined' : 'filled'}
      />
    </ExplainTip>
  );
}

const PHASE_CHIP: Record<DecisionPhase, { label: string; color: ChipProps['color'] }> = {
  unconfirmed: { label: 'Waiting for a block', color: 'default' },
  early: { label: 'Collecting approvals', color: 'primary' },
  open: { label: 'Collecting approvals', color: 'primary' },
  thresholdMet: { label: 'Enough approvals', color: 'success' },
  rejectedMet: { label: 'Enough rejections', color: 'error' },
  tooLate: { label: 'Too late to approve', color: 'default' },
  expired: { label: 'Expired', color: 'default' },
};

/** A decision's phase; what it means on hover or a tap (and focus, with `focusable`). */
export function DecisionPhaseChip({
  phase,
  focusable = false,
}: {
  phase: DecisionPhase;
  focusable?: boolean;
}) {
  const chip = PHASE_CHIP[phase];
  return (
    <ExplainTip text={DECISION_PHASE_EXPLANATION[phase]} focusable={focusable}>
      <ToneChip
        size="small"
        label={chip.label}
        color={chip.color}
        variant={chip.color === 'default' ? 'outlined' : 'filled'}
      />
    </ExplainTip>
  );
}
