/**
 * A small, cheap celebration (CSS only) when someone becomes a minter.
 * Skipped with reduced motion or when turned off in Settings.
 */
import { useMemo } from 'react';
import { Box, keyframes } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { celebrateAtom } from '../../state/settings';

const fall = keyframes`
  0% { transform: translate3d(0, -10px, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--dx), 160px, 0) rotate(540deg); opacity: 0; }
`;

const COLOURS = ['primary.main', 'secondary.main', 'success.main', 'warning.main', 'info.main'];

export function Celebration({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const enabled = useAtomValue(celebrateAtom);
  const bits = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        dx: `${((i * 53) % 80) - 40}px`,
        delay: `${(i % 6) * 60}ms`,
        colour: COLOURS[i % COLOURS.length],
        size: 6 + (i % 3) * 2,
      })),
    []
  );
  if (!active || reduced || !enabled) return null;
  return (
    <Box
      aria-hidden
      sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {bits.map((b, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: 0,
            left: b.left,
            width: b.size,
            height: b.size * 1.6,
            borderRadius: 0.5,
            bgcolor: b.colour,
            '--dx': b.dx,
            animation: `${fall} 1200ms ease-out ${b.delay} 1 both`,
          }}
        />
      ))}
    </Box>
  );
}
