/**
 * The one dialog frame (docs/DESIGN.md → Mobile → Dialogs): centred on
 * wider layouts, full screen under 600 px (sized to Hub's frame, not 100vh),
 * 44 px actions, a labelled title and a close button on phones.
 * Adapted from Q-Mail+.
 *
 * Focus comes back when it closes, even when the button that opened it is
 * gone (Sign turns into "Signed ✓", Accept into "Sending…"): then to the
 * card or section that held it, or to `returnFocus()`, never to <body>;
 * also when its parent stops rendering it instead of closing it.
 */
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  type DialogProps,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useLandscapeFrame } from '../../utils/hubFrame';

export interface ResponsiveDialogProps {
  open: boolean;
  /** Omit to make the dialog non-dismissable (e.g. while Hub is asking). */
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  maxWidth?: DialogProps['maxWidth'];
  /** Full screen on every layout. */
  fullScreen?: boolean;
  describedBy?: string;
  /** Where focus goes on close when the opener and its card are gone. */
  returnFocus?: () => HTMLElement | null;
}

/** The containers a dialog's opener sits in that usually outlive it. */
const ANCHOR = 'article, [role="article"], li, section, [role="region"], main';

function focusBack(target: HTMLElement): void {
  if (!target.hasAttribute('tabindex') && target.tabIndex < 0)
    target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: false });
}

export function ResponsiveDialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullScreen = false,
  describedBy,
  returnFocus,
}: ResponsiveDialogProps) {
  const phone = usePhoneLayout() || fullScreen;
  const compactTitle = useLandscapeFrame() && phone;
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const opener = useRef<{ element: HTMLElement | null; anchor: HTMLElement | null }>({
    element: null,
    anchor: null,
  });

  // Open, or closing: focus still has to come back.
  const shown = useRef(false);
  const mounted = useRef(false);
  const restoreLater = useRef<() => void>(() => {});

  // Before the focus trap moves focus in (layout effects run first): who opened it.
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    const element = active instanceof HTMLElement && active !== document.body ? active : null;
    opener.current = { element, anchor: element?.closest<HTMLElement>(ANCHOR) ?? null };
    shown.current = true;
  }, [open]);

  // A dialog whose parent stops rendering it (rather than closing it) never
  // gets onExited: it puts focus back once it is gone.
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!shown.current) return;
      // After React has removed it (and not for React's dev-only remount).
      setTimeout(() => {
        if (!mounted.current) restoreLater.current();
      }, 0);
    };
  }, []);

  const restoreFocus = () => {
    shown.current = false;
    const active = document.activeElement;
    // Another dialog or field already has focus: leave it there.
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      active.isConnected &&
      !rootRef.current?.contains(active)
    )
      return;
    const { element, anchor } = opener.current;
    opener.current = { element: null, anchor: null };
    if (element?.isConnected) {
      element.focus({ preventScroll: true });
      return;
    }
    const target =
      returnFocus?.() ??
      (anchor?.isConnected ? anchor : null) ??
      document.querySelector<HTMLElement>('main');
    if (target) focusBack(target);
  };
  restoreLater.current = restoreFocus;

  return (
    <Dialog
      ref={rootRef}
      open={open}
      onClose={onClose ? () => onClose() : undefined}
      fullScreen={phone}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={title ? id : undefined}
      aria-describedby={describedBy}
      // MUI would focus the opener even when it is gone (focus then falls to <body>).
      disableRestoreFocus
      slotProps={{
        transition: { onExited: restoreFocus },
        paper: {
          sx: {
            display: 'flex',
            flexDirection: 'column',
            ...(phone
              ? {
                  height: 'var(--qmp-app-height, 100dvh)',
                  maxHeight: 'var(--qmp-app-height, 100dvh)',
                  paddingTop: 'env(safe-area-inset-top, 0px)',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }
              : { maxHeight: 'calc(var(--qmp-app-height, 100dvh) - 32px)' }),
          },
        },
      }}
    >
      {title ? (
        <DialogTitle
          id={id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pr: phone && onClose ? 1 : 3,
            fontSize: '1.125rem',
            fontWeight: 700,
            // Focused by the app while a write runs (utils/focus.ts), not by the user: no ring.
            '&:focus': { outline: 'none' },
            ...(compactTitle ? { py: 0.5 } : {}),
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
          {phone && onClose ? (
            <IconButton onClick={onClose} aria-label="Close" sx={{ width: 44, height: 44 }}>
              <CloseIcon />
            </IconButton>
          ) : null}
        </DialogTitle>
      ) : null}
      <DialogContent
        dividers={Boolean(title) && phone}
        tabIndex={0}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}
      >
        {children}
      </DialogContent>
      {actions ? (
        <DialogActions
          sx={{
            gap: 1,
            px: 2,
            py: 1.5,
            flexWrap: 'wrap',
            '& .MuiButton-root': { minHeight: 44, minWidth: 88 },
            ...(phone ? { '& .MuiButton-root': { minHeight: 48, flex: '1 1 auto' } } : {}),
          }}
        >
          {actions}
        </DialogActions>
      ) : null}
    </Dialog>
  );
}
