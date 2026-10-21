/**
 * A short note that opens just under the button that was pressed ("Added
 * to compare (2 of 4)"), in the theme's own card with a small arrow
 * pointing at the button, instead of a bar at the edge of the screen. It
 * closes by itself after a few seconds (not while the pointer or the focus
 * is on it), on a press elsewhere, or with Escape. It renders inside the
 * page (no portal), in a polite live region that stays mounted, so screen
 * readers hear it once.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, ClickAwayListener, Fade, Paper, Popper } from '@mui/material';

export interface AnchoredNoteProps {
  /** The button the note points at. */
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** A button inside the note, after its words ("Compare now"). */
  action?: ReactNode;
  autoHideMs?: number;
}

export function AnchoredNote({
  anchor,
  open,
  onClose,
  children,
  action,
  autoHideMs = 5000,
}: AnchoredNoteProps) {
  const [held, setHeld] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open || held) return;
    const timer = setTimeout(() => closeRef.current(), autoHideMs);
    return () => clearTimeout(timer);
  }, [open, held, autoHideMs, children]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <Box aria-live="polite" sx={{ display: 'contents' }}>
      <Popper
        open={open && Boolean(anchor)}
        anchorEl={anchor}
        placement="bottom-end"
        disablePortal
        transition
        modifiers={[
          { name: 'offset', options: { offset: [0, 10] } },
          { name: 'preventOverflow', options: { padding: 12 } },
        ]}
        sx={(theme) => ({ zIndex: theme.zIndex.appBar + 1 })}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={150}>
            <div>
              <ClickAwayListener
                onClickAway={(event) => {
                  // The button itself shows the next note; it isn't "elsewhere".
                  if (anchor && event.target instanceof Node && anchor.contains(event.target))
                    return;
                  closeRef.current();
                }}
              >
                <Paper
                  elevation={0}
                  onMouseEnter={() => setHeld(true)}
                  onMouseLeave={() => setHeld(false)}
                  onFocus={() => setHeld(true)}
                  onBlur={() => setHeld(false)}
                  sx={(theme) => ({
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    columnGap: 1,
                    rowGap: 0.5,
                    px: 1.5,
                    py: action ? 0.5 : 1,
                    maxWidth: 'min(360px, calc(100vw - 24px))',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1.5,
                    boxShadow: theme.shadows[8],
                    fontSize: 14,
                    lineHeight: 1.4,
                    // A small arrow up to the button's middle (the note's right edge
                    // lines up with the button's; a 44 px button's middle is 22 px in).
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: -6,
                      right: 16,
                      width: 10,
                      height: 10,
                      bgcolor: 'background.paper',
                      borderLeft: `1px solid ${theme.palette.divider}`,
                      borderTop: `1px solid ${theme.palette.divider}`,
                      transform: 'rotate(45deg)',
                    },
                  })}
                >
                  <Box component="span" sx={{ py: 0.5 }}>
                    {children}
                  </Box>
                  {action}
                </Paper>
              </ClickAwayListener>
            </div>
          </Fade>
        )}
      </Popper>
    </Box>
  );
}
