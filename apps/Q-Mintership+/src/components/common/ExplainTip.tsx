/**
 * A chip that says what it means (constants/chipExplanations.ts) on hover,
 * on a tap (a phone has no hover: a tap shows it at once, and it stays a
 * few seconds), and, with `focusable`, on keyboard focus, where screen
 * readers hear it as the chip's description. Lists keep their chips out of
 * the Tab order (one stop per chip in a long list is too many); a page's
 * own header chips take the focus.
 */
import { cloneElement, type ReactElement } from 'react';
import { Tooltip } from '@mui/material';

export function ExplainTip({
  text,
  focusable = false,
  children,
}: {
  /** What the chip means; none leaves the chip as it is. */
  text: string | null | undefined;
  focusable?: boolean;
  children: ReactElement<{ tabIndex?: number }>;
}) {
  if (!text) return children;
  return (
    <Tooltip
      title={text}
      describeChild
      arrow
      enterTouchDelay={0}
      leaveTouchDelay={6000}
      slotProps={{ tooltip: { sx: { fontSize: 14, lineHeight: 1.45, maxWidth: 340 } } }}
    >
      {focusable ? cloneElement(children, { tabIndex: 0 }) : children}
    </Tooltip>
  );
}
