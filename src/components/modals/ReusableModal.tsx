import React from 'react'
import { Dialog } from '@mui/material'
import { useLayoutMode } from '../../layout/useLayoutMode'

interface MyModalProps {
  open: boolean
  onClose?: () => void
  onSubmit?: (obj: any) => Promise<void>
  children: any
  /** Styles for the dialog paper on medium/desktop (width, height, radius…). */
  customStyles?: Record<string, unknown>
}

// Position keys from the old centred-Box API; the Dialog centres itself.
const POSITION_KEYS = new Set(['position', 'top', 'left', 'right', 'bottom', 'transform'])

/**
 * A free-form dialog (the thread composer, the legacy message modal): a
 * centred paper on medium/desktop that takes `customStyles`, full-screen on
 * phones. The focus trap stays on (UX #34).
 */
export const ReusableModal: React.FC<MyModalProps> = ({ open, onClose, children, customStyles = {} }) => {
  const isPhone = useLayoutMode() === 'phone'
  const paperStyles = Object.fromEntries(
    Object.entries(customStyles).filter(([key]) => !POSITION_KEYS.has(key))
  )
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isPhone}
      fullWidth
      maxWidth={false}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      slotProps={{
        backdrop: { style: { backdropFilter: 'blur(3px)' } },
        paper: {
          sx: (theme) => ({
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            p: 4,
            backgroundImage: 'none',
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            ...(isPhone
              ? {
                  m: 0,
                  p: 0,
                  gap: 0,
                  width: '100%',
                  maxWidth: '100%',
                  height: 'var(--qmail-app-height, 100dvh)',
                  maxHeight: 'var(--qmail-app-height, 100dvh)',
                  borderRadius: 0,
                  paddingTop: 'env(safe-area-inset-top, 0px)',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }
              : {
                  width: '75%',
                  maxHeight: 'calc(var(--qmail-app-height, 100dvh) - 32px)',
                  ...paperStyles,
                }),
          }),
        },
      }}
    >
      {children}
    </Dialog>
  )
}
