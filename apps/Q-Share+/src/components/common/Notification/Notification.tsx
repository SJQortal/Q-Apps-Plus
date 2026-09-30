import { useEffect, type CSSProperties } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toast, ToastContainer, Slide } from 'react-toastify'
import { useTheme } from '@mui/material/styles'
import 'react-toastify/dist/ReactToastify.css'
import { removeNotification } from '../../../state/features/notificationsSlice'
import { RootState } from '../../../state/store'
import { useHubTheme } from '../../../hub-theme'
import { usePhoneLayout } from '../../../hooks/usePhoneLayout'
import { useBottomChromeHeight } from '../../layout/BottomNav/BottomNav'

/**
 * Shows the app's notifications (Redux `notifications.alertTypes`) as toasts.
 * Everything happens in an effect: nothing is dispatched during render.
 */
const Notification = () => {
  const dispatch = useDispatch()
  const theme = useTheme()
  const { mode } = useHubTheme()
  const phone = usePhoneLayout()
  // Toasts sit above the bar and the floating Share button, not on them.
  const bottomChrome = useBottomChromeHeight()
  const { alertTypes } = useSelector((state: RootState) => state.notifications)
  const { alertError, alertSuccess, alertInfo } = alertTypes

  useEffect(() => {
    if (!alertError && !alertSuccess && !alertInfo) return
    if (alertError) toast.error(alertError, { autoClose: 5000 })
    if (alertSuccess) toast.success(alertSuccess, { autoClose: 4000 })
    if (alertInfo) toast.info(alertInfo, { autoClose: 2500 })
    dispatch(removeNotification())
  }, [alertError, alertSuccess, alertInfo, dispatch])

  // react-toastify paints with its own CSS variables; feed it the theme so all four looks match.
  const containerStyle = {
    '--toastify-color-light': theme.palette.background.paper,
    '--toastify-color-dark': theme.palette.background.paper,
    '--toastify-text-color-light': theme.palette.text.primary,
    '--toastify-text-color-dark': theme.palette.text.primary,
    '--toastify-color-info': theme.palette.primary.main,
    '--toastify-color-success': theme.palette.success.main,
    '--toastify-color-error': theme.palette.error.main,
    '--toastify-color-progress-light': theme.palette.primary.main,
    '--toastify-color-progress-dark': theme.palette.primary.main,
    '--toastify-font-family': String(theme.typography.fontFamily),
    '--toastify-toast-min-height': '48px',
    ...(phone
      ? { bottom: `calc(${bottomChrome + 8}px + env(safe-area-inset-bottom, 0px))`, left: 0, right: 0, width: '100%', padding: '0 12px' }
      : {}),
  } as CSSProperties

  return (
    <ToastContainer
      position={phone ? 'bottom-center' : 'bottom-right'}
      theme={mode === 'dark' ? 'dark' : 'light'}
      transition={Slide}
      limit={3}
      role="status"
      closeOnClick
      pauseOnHover
      pauseOnFocusLoss
      draggable
      newestOnTop={false}
      hideProgressBar={false}
      style={containerStyle}
      toastStyle={{ fontSize: 15, borderRadius: theme.shape.borderRadius }}
    />
  )
}

export default Notification
