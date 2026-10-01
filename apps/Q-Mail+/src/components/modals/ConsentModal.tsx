import * as React from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useTheme } from '@mui/material'

/** Set once the disclaimer has been shown on this browser. */
export const CONSENT_STORAGE_KEY = 'qmail-general-consent'

export function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true'
  } catch {
    return true
  }
}

export default function ConsentModal() {
  const theme = useTheme()

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
    <div>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Welcome</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            The Qortal community, along with its development team and the
            creators of this application, cannot be held accountable for any
            content published or displayed. Furthermore, they bear no
            responsibility for any data loss that may occur as a result of using
            this application.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            sx={{
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.text.primary
            }}
            onClick={handleClose}
            autoFocus
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
