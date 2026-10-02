/**
 * App-wide toasts on MUI Snackbar + Alert (replaces react-toastify, Bundle
 * §5.7). The redux notification is consumed in an effect, never during render
 * (Bugs #22), and queued so two quick messages both show.
 *
 * On phones the toast sits above the bottom bar and to the left of the
 * floating Compose button, so it never covers either (docs/QORTAL.md →
 * Hub & GO pitfalls 6); in a landscape frame, where neither shows, it drops
 * to the bottom edge.
 */
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Alert, Snackbar, useMediaQuery, useTheme } from '@mui/material'
import { removeNotification } from '../../../state/features/notificationsSlice'
import { RootState } from '../../../state/store'
import { BOTTOM_NAV_HEIGHT } from '../../../layout/BottomNav'
import { LANDSCAPE_FRAME_MEDIA } from '../../../utils/hubFrame'

/** Width the floating button needs at the right edge: 56 px button, 16 px gutter, 16 px gap. */
export const FAB_GUTTER = 88

type Severity = 'success' | 'error' | 'info'

interface Toast {
  key: number
  severity: Severity
  message: string
}

const AUTO_HIDE_MS: Record<Severity, number> = { success: 4000, error: 6000, info: 2500 }

let nextKey = 1

const Notification = () => {
  const dispatch = useDispatch()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const { alertTypes } = useSelector((state: RootState) => state.notifications)
  const [queue, setQueue] = useState<Toast[]>([])
  const [current, setCurrent] = useState<Toast | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const incoming: Toast[] = []
    if (alertTypes.alertError) incoming.push({ key: nextKey++, severity: 'error', message: alertTypes.alertError })
    if (alertTypes.alertSuccess) incoming.push({ key: nextKey++, severity: 'success', message: alertTypes.alertSuccess })
    if (alertTypes.alertInfo) incoming.push({ key: nextKey++, severity: 'info', message: alertTypes.alertInfo })
    if (!incoming.length) return
    setQueue((previous) => [...previous, ...incoming])
    dispatch(removeNotification())
  }, [alertTypes.alertError, alertTypes.alertInfo, alertTypes.alertSuccess, dispatch])

  useEffect(() => {
    if (current || !queue.length) return
    setCurrent(queue[0])
    setQueue((previous) => previous.slice(1))
    setOpen(true)
  }, [current, queue])

  const handleClose = (_event?: unknown, reason?: string) => {
    if (reason === 'clickaway') return
    setOpen(false)
  }

  return (
    <Snackbar
      key={current?.key}
      open={open && Boolean(current)}
      autoHideDuration={current ? AUTO_HIDE_MS[current.severity] : null}
      onClose={handleClose}
      slotProps={{ transition: { onExited: () => setCurrent(null) } }}
      anchorOrigin={{ vertical: 'bottom', horizontal: isPhone ? 'left' : 'right' }}
      sx={{
        bottom: { xs: `calc(${BOTTOM_NAV_HEIGHT + 12}px + env(safe-area-inset-bottom, 0px))`, sm: 24 },
        left: { xs: 12, sm: 'auto' },
        right: { xs: FAB_GUTTER, sm: 24 },
        [`@media ${LANDSCAPE_FRAME_MEDIA}`]: { bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', right: 24 },
      }}
    >
      <Alert
        severity={current?.severity || 'info'}
        variant="filled"
        onClose={() => setOpen(false)}
        role={current?.severity === 'error' ? 'alert' : 'status'}
        sx={{ width: '100%', maxWidth: 480, fontSize: '0.9375rem', alignItems: 'center' }}
      >
        {current?.message}
      </Alert>
    </Snackbar>
  )
}

export default Notification
