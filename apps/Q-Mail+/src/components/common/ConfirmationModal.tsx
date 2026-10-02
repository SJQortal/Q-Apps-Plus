import React from 'react'
import { Box, Button, DialogContentText } from '@mui/material'
import { ResponsiveDialog } from './ResponsiveDialog'

export interface ModalProps {
  open: boolean
  title: string
  message: string
  children?: React.ReactNode
  handleConfirm: () => void
  handleCancel: () => void
  /** The verb on the confirming button, e.g. "Delete", "Publish", "Load state". */
  confirmLabel?: string
  cancelLabel?: string
  /** Colours the confirming button as a destructive action. */
  destructive?: boolean
}

/**
 * A yes/no question (docs/DESIGN.md → Dialogs: "confirm anything that
 * publishes, spends QORT or deletes"). Full-screen on phones, 44 px actions.
 */
const ConfirmationModal: React.FC<ModalProps> = ({
  open,
  title,
  message,
  children,
  handleConfirm,
  handleCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false
}) => {
  return (
    <ResponsiveDialog
      open={open}
      onClose={handleCancel}
      title={title}
      describedBy="qmail-confirm-description"
      maxWidth="xs"
      actions={
        <>
          <Button variant="outlined" color="inherit" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant="contained"
            color={destructive ? 'error' : 'primary'}
            onClick={handleConfirm}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <DialogContentText id="qmail-confirm-description" sx={{ fontSize: '1rem' }}>
        {message}
      </DialogContentText>
      {children && <Box sx={{ mt: 2 }}>{children}</Box>}
    </ResponsiveDialog>
  )
}

export default ConfirmationModal
