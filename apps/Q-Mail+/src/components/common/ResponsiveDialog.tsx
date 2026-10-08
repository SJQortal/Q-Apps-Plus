/**
 * The one dialog frame for Q-Mail+ (docs/DESIGN.md → Mobile → Dialogs):
 * a centred MUI Dialog on medium and desktop layouts, full-screen under
 * 600 px (or whenever `fullScreen` asks), with 44 px actions, the focus trap
 * left on and a labelled title. A full-screen sheet in a landscape frame gets
 * a compact title bar, so its content keeps most of the 201 px height.
 */
import type { ReactNode } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  type DialogProps,
} from '@mui/material';
import { OverlayBackClose } from '../../layout/OverlayBackClose';
import CloseIcon from '@mui/icons-material/Close';
import { useLayoutMode } from '../../layout/useLayoutMode';
import { useLandscapeFrame } from '../../utils/hubFrame';

export interface ResponsiveDialogProps {
  open: boolean;
  /** Omit to make the dialog non-dismissable (e.g. while publishing). */
  onClose?: () => void;
  title?: ReactNode;
  /** The id of the element that describes the dialog, for aria-describedby. */
  describedBy?: string;
  children?: ReactNode;
  /** Buttons for the footer; they get 44 px tap targets. */
  actions?: ReactNode;
  /** Show an X in the title (defaults to true on phones when onClose exists). */
  showClose?: boolean;
  maxWidth?: DialogProps['maxWidth'];
  fullWidth?: boolean;
  /** Remove the content padding (for pages that bring their own layout). */
  flush?: boolean;
  /** Full screen on every layout, not just phones (a long list in a short frame). */
  fullScreen?: boolean;
  /** Extra styles for the paper on medium/desktop, e.g. a fixed height. */
  paperSx?: Record<string, unknown>;
  titleId?: string;
  className?: string;
}

let nextId = 1;

export function ResponsiveDialog({
  open,
  onClose,
  title,
  describedBy,
  children,
  actions,
  showClose,
  maxWidth = 'sm',
  fullWidth = true,
  flush = false,
  fullScreen = false,
  paperSx,
  titleId,
  className,
}: ResponsiveDialogProps) {
  const isPhone = useLayoutMode() === 'phone' || fullScreen;
  const compactTitle = useLandscapeFrame() && isPhone;
  const id = titleId || `qmail-dialog-${nextId++}`;
  const closeInTitle = showClose ?? (isPhone && Boolean(onClose));

  return (
    <>
    {/* Full screen on a phone: Back closes the dialog, not the pane under it. */}
    <OverlayBackClose open={open} onClose={() => onClose?.()} enabled={isPhone && Boolean(onClose)} />
    <Dialog
      open={open}
      onClose={onClose ? () => onClose() : undefined}
      fullScreen={isPhone}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      aria-labelledby={title ? id : undefined}
      aria-describedby={describedBy}
      className={className}
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            flexDirection: 'column',
            ...(isPhone
              ? {
                  // The GO/Hub frame, not 100vh, so nothing hides behind the keyboard.
                  height: 'var(--qmail-app-height, 100dvh)',
                  maxHeight: 'var(--qmail-app-height, 100dvh)',
                  paddingTop: 'env(safe-area-inset-top, 0px)',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }
              : { maxHeight: 'calc(var(--qmail-app-height, 100dvh) - 32px)' }),
            ...(paperSx || {}),
          },
        },
      }}
    >
      {title && (
        <DialogTitle
          id={id}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pr: closeInTitle ? 1 : 3,
            ...(compactTitle ? { py: 0.5 } : {}),
            fontSize: '1.125rem',
            fontWeight: 700,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
          {closeInTitle && onClose && (
            <IconButton onClick={onClose} aria-label="Close" sx={{ minWidth: 44, minHeight: 44 }}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
      )}
      <DialogContent
        dividers={Boolean(title) && isPhone}
        // A tab stop: when the content scrolls (the shortcuts list on a short
        // desktop window), keyboard users can reach and scroll it.
        tabIndex={0}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          ...(flush ? { p: 0 } : {}),
        }}
      >
        {children}
      </DialogContent>
      {actions && (
        <DialogActions
          sx={{
            gap: 1,
            px: 2,
            py: 1.5,
            flexWrap: 'wrap',
            '& .MuiButton-root': { minHeight: 44, minWidth: 88 },
            ...(isPhone ? { '& .MuiButton-root': { minHeight: 48, minWidth: 96, flex: '1 1 auto' } } : {}),
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
    </>
  );
}
