/**
 * The one dialog frame (docs/DESIGN.md → Mobile → Dialogs): centred on
 * wider layouts, full screen under 600 px (sized to Hub's frame, not 100vh),
 * 44 px actions, a labelled title and a close button on phones.
 * Adapted from Q-Mail+.
 */
import { useId, type ReactNode } from 'react';
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
}: ResponsiveDialogProps) {
  const phone = usePhoneLayout() || fullScreen;
  const compactTitle = useLandscapeFrame() && phone;
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose ? () => onClose() : undefined}
      fullScreen={phone}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={title ? id : undefined}
      aria-describedby={describedBy}
      slotProps={{
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
