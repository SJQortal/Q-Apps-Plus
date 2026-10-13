/**
 * The Refresh button in page headers, and its icon for other buttons
 * ("Check again"). The icon turns while the read runs: a press always gets
 * at least one smooth turn, it keeps turning only while the read is still
 * running, and it comes to rest on a whole turn, never mid-way.
 *
 * The turn is three CSS animations: a half turn that speeds up from rest, a
 * steady loop of whole turns, and a half turn that slows to rest. The ends
 * leave and meet the loop at its own speed, so there is no jolt between them.
 * Each change of step happens as one ends (animationend/animationiteration),
 * in the same frame, so the icon never jumps.
 *
 * With reduced motion it doesn't turn: the icon dims while the read runs.
 * Screen readers hear only the button's name; the pages say what changed.
 * The button stays enabled while it reads, so focus stays on it; a press
 * then does nothing, so a read is never started twice.
 */
import { useState, type AnimationEvent } from 'react';
import { flushSync } from 'react-dom';
import { Box, IconButton, Tooltip, keyframes } from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/** One turn of the loop. */
const TURN_MS = 600;
/**
 * The half turns at either end. They start (or end) at rest and meet the
 * loop at 1.5 times their average speed: 180° in 1.5 × TURN_MS / 2.
 */
const HALF_MS = (1.5 * TURN_MS) / 2;

const speedUp = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(180deg); }
`;
const loop = keyframes`
  from { transform: rotate(180deg); }
  to { transform: rotate(540deg); }
`;
const slowDown = keyframes`
  from { transform: rotate(180deg); }
  to { transform: rotate(360deg); }
`;

/** Where the icon is in its turn. */
type Step = 'rest' | 'start' | 'loop' | 'stop';

const ANIMATION: Record<Exclude<Step, 'rest'>, string> = {
  // Slope 0 → 1.5, and 1.5 → 0: from rest to the loop's speed, and back.
  start: `${speedUp} ${HALF_MS}ms cubic-bezier(0.4, 0, 0.6, 0.4) forwards`,
  loop: `${loop} ${TURN_MS}ms linear infinite`,
  stop: `${slowDown} ${HALF_MS}ms cubic-bezier(0.4, 0.6, 0.6, 1) forwards`,
};

export interface RefreshIconProps {
  /** The read is running. */
  busy: boolean;
  /** Bumped by each press, so a press turns it even when the read is instant. */
  presses?: number;
}

/** The refresh icon, turning while `busy` (see the file comment). */
export function RefreshIcon({ busy, presses = 0 }: RefreshIconProps) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState<Step>('rest');
  const [seenPresses, setSeenPresses] = useState(presses);
  // A press while it was slowing down: it owes that press another turn.
  const [owed, setOwed] = useState(false);

  // A press, or a read starting (the page's own refresh too), sets it going.
  // Set while rendering: React's pattern for state that follows props.
  if (presses !== seenPresses) {
    setSeenPresses(presses);
    if (!reduced && step === 'rest') setStep('start');
    else if (!reduced && step === 'stop') setOwed(true);
  }
  if (!reduced && step === 'rest' && busy) setStep('start');

  const advance = (event: AnimationEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    let next: Step;
    if (step === 'start' || step === 'loop') next = busy ? 'loop' : 'stop';
    else next = step === 'stop' && (busy || owed) ? 'start' : 'rest';
    if (next === step) return;
    // In this frame, before it paints: the next step starts where this one ended.
    flushSync(() => {
      setStep(next);
      setOwed(false);
    });
  };

  const turning = !reduced && step !== 'rest';
  return (
    <Box
      component="span"
      aria-hidden
      data-turn={turning ? step : undefined}
      onAnimationEnd={advance}
      onAnimationIteration={step === 'loop' ? advance : undefined}
      sx={{
        display: 'inline-flex',
        animation: turning ? ANIMATION[step as Exclude<Step, 'rest'>] : 'none',
        // Reduced motion: no turning, a dimmed icon while it reads.
        opacity: reduced && busy ? 0.6 : 1,
      }}
    >
      {/* The button's icon size: 24 px in an IconButton, 20 px as a Button's startIcon. */}
      <RefreshOutlinedIcon fontSize="inherit" />
    </Box>
  );
}

export interface RefreshButtonProps {
  onClick: () => void;
  /** The read the button starts is running (a press or the page's own refresh). */
  fetching?: boolean;
  /** The button's name, also its tooltip: "Refresh", "Refresh nominations". */
  label?: string;
}

/** A 44 px icon button with a tooltip, for page headers. */
export function RefreshButton({
  onClick,
  fetching = false,
  label = 'Refresh',
}: RefreshButtonProps) {
  const [presses, setPresses] = useState(0);
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={() => {
          if (fetching) return;
          setPresses((n) => n + 1);
          onClick();
        }}
        sx={{ width: 44, height: 44 }}
      >
        <RefreshIcon busy={fetching} presses={presses} />
      </IconButton>
    </Tooltip>
  );
}
