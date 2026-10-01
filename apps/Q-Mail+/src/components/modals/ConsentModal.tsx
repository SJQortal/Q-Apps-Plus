import * as React from 'react'
import { Button, DialogContentText } from '@mui/material'
import { ResponsiveDialog } from '../common/ResponsiveDialog'

/** Set once the disclaimer has been shown on this browser. */
export const CONSENT_STORAGE_KEY = 'qmail-general-consent'

export function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true'
  } catch {
    return true
  }
}

/** The one-time disclaimer (the tour no longer repeats it, UX #25). */
export default function ConsentModal() {
  const [open, setOpen] = React.useState(false)

  const handleClose = () => {
    setOpen(false)
  }

  React.useEffect(() => {
    if (hasConsented()) return
    setOpen(true)
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true')
    } catch {
      /* private mode: show it again next time */
    }
  }, [])

  return (
    <ResponsiveDialog
      open={open}
      onClose={handleClose}
      title="Welcome to Q-Mail+"
      describedBy="qmail-consent-description"
      maxWidth="xs"
      actions={
        <Button variant="contained" onClick={handleClose} autoFocus>
          Got it
        </Button>
      }
    >
      <DialogContentText id="qmail-consent-description" sx={{ fontSize: '1rem' }}>
        The Qortal community, along with its development team and the creators of this
        application, cannot be held accountable for any content published or displayed.
        Furthermore, they bear no responsibility for any data loss that may occur as a
        result of using this application.
      </DialogContentText>
    </ResponsiveDialog>
  )
}
