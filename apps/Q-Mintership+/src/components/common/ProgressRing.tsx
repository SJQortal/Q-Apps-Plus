/**
 * The k-of-n ring: confirmed signatures as a solid arc, signatures still
 * confirming as a lighter arc after it, the target as a tick. It fills
 * smoothly as signatures land (no animation with reduced motion).
 */
import { useEffect, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { COUNT_UP_MS, motionReduced } from '../../hooks/useCountUp';

export interface ProgressRingProps {
  /** Confirmed signatures. */
  value: number;
  /** Signatures needed. */
  target: number;
  /** Signatures in flight (counted once they confirm). */
  pending?: number;
  size?: number;
  /** The accessible description; defaults to "5 of 8 signatures". */
  label?: string;
  /** Colour of the filled arc. */
  tone?: 'primary' | 'success' | 'warning' | 'error';
  /** Hidden from screen readers, when the words beside it say the same (inside a link). */
  decorative?: boolean;
}

export function ProgressRing({
  value,
  target,
  pending = 0,
  size = 56,
  label,
  tone,
  decorative = false,
}: ProgressRingProps) {
  const theme = useTheme();
  const stroke = Math.max(4, Math.round(size / 10));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeTarget = Math.max(1, target);
  const done = Math.min(1, value / safeTarget);
  const projected = Math.min(1, (value + pending) / safeTarget);
  const met = value >= target && target > 0;
  const colour = theme.palette[tone ?? (met ? 'success' : 'primary')].main;
  const text =
    label ?? `${value} of ${target} approvals${pending ? `, ${pending} confirming` : ''}`;
  // From 56 px (cards, pages, Home) "of 8" is a quarter of the ring, 14 px or more, on one
  // line height; "100 of 99" still sits inside the ring in every theme's font (Inter, and
  // the system fonts' widest). Smaller rings keep their size.
  const large = size >= 56;
  const targetFont = large ? size / 4 : Math.max(11, size * 0.2);

  return (
    <Box
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : text}
      aria-hidden={decorative || undefined}
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.palette.divider}
          strokeWidth={stroke}
        />
        {pending > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={alpha(colour, 0.4)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${projected * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 600ms ease' }}
          />
        ) : null}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${done * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms ease, stroke 300ms ease' }}
        />
      </svg>
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Typography
          component="span"
          sx={{ fontWeight: 800, fontSize: Math.max(12, size * 0.28), lineHeight: 1 }}
        >
          {value}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: targetFont, color: 'text.secondary', lineHeight: large ? 1 : 1.1 }}
        >
          of {target}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * A bar for progress that isn't approvals (level progress, participation,
 * the members' levels read): a rounded track tinted in the theme's primary
 * colour, filled with a gradient of it. It fills from empty when it first
 * shows and glides to a new value, in step with a number counting up beside
 * it (hooks/useCountUp.ts: the same 900 ms, easing out). Reduced motion
 * shows it full at once.
 */
export function ProgressBar({
  value,
  label,
  valueText,
}: {
  value: number;
  label: string;
  /** The value in words ("120 of 629 members"), read instead of the percentage. */
  valueText?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  // Empty on the first paint, then the value: the width's transition fills it.
  const [filled, setFilled] = useState(motionReduced);
  useEffect(() => {
    if (filled) return;
    const frame = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(frame);
  }, [filled]);
  return (
    <Box
      role="progressbar"
      aria-label={label}
      aria-valuetext={valueText}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      sx={{ width: '100%' }}
    >
      <Box
        sx={(theme) => ({
          height: 10,
          borderRadius: 999,
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.12),
          overflow: 'hidden',
        })}
      >
        <Box
          sx={(theme) => ({
            width: `${filled ? pct : 0}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.6)}, ${theme.palette.primary.main})`,
            transition: `width ${COUNT_UP_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`,
          })}
        />
      </Box>
    </Box>
  );
}
