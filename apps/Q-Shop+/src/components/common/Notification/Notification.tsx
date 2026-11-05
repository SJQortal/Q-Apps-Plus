import { useEffect, type CSSProperties } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast, ToastContainer, Slide } from "react-toastify";
import { useTheme } from "@mui/material/styles";
import "react-toastify/dist/ReactToastify.css";
import { removeNotification } from "../../../state/features/notificationsSlice";
import type { RootState } from "../../../state/store";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useBottomChromeHeight } from "../../layout/BottomNav/BottomNav";

/**
 * Shows the app's notifications (Redux `notifications.alertTypes`) as toasts,
 * after Q-Share+'s: themed in all four looks, above the phone's bottom bar
 * (docs/QORTAL.md → pitfall 6), at most three at a time. Everything happens
 * in an effect: nothing is dispatched during render, as the original did.
 */
const Notification = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const phone = usePhoneLayout();
  const bottomChrome = useBottomChromeHeight();
  const { alertError, alertSuccess, alertInfo } = useSelector((state: RootState) => state.notifications.alertTypes);

  useEffect(() => {
    if (!alertError && !alertSuccess && !alertInfo) return;
    if (alertError) toast.error(alertError, { autoClose: 5000 });
    if (alertSuccess) toast.success(alertSuccess, { autoClose: 4000 });
    if (alertInfo) toast.info(alertInfo, { autoClose: 3000 });
    dispatch(removeNotification());
  }, [alertError, alertSuccess, alertInfo, dispatch]);

  // react-toastify paints with its own CSS variables; feed it the theme so all four looks match.
  const containerStyle = {
    "--toastify-color-light": theme.palette.background.paper,
    "--toastify-text-color-light": theme.palette.text.primary,
    "--toastify-color-info": theme.palette.primary.main,
    "--toastify-color-success": theme.palette.success.main,
    "--toastify-color-error": theme.palette.error.main,
    "--toastify-icon-color-info": theme.palette.primary.main,
    "--toastify-icon-color-success": theme.palette.success.main,
    "--toastify-icon-color-error": theme.palette.error.main,
    "--toastify-color-progress-light": theme.palette.primary.main,
    "--toastify-font-family": String(theme.typography.fontFamily),
    "--toastify-toast-min-height": "48px",
    // Full width on phones, above the bottom bar. bottom-center also shifts the
    // container left by half its width, and react-toastify only undoes that at
    // 480 px or less; a landscape phone would lose the left half of every toast,
    // so cancel the shift here and clear the side notches.
    ...(phone
      ? {
          bottom: `calc(${bottomChrome + 8}px + env(safe-area-inset-bottom, 0px))`,
          left: 0,
          right: 0,
          width: "100%",
          transform: "none",
          padding: "0 calc(12px + env(safe-area-inset-right, 0px)) 0 calc(12px + env(safe-area-inset-left, 0px))",
          boxSizing: "border-box",
        }
      : {}),
  } as CSSProperties;

  return (
    <ToastContainer
      position={phone ? "bottom-center" : "bottom-right"}
      // The light palette variables carry the theme's colours in every look.
      theme="light"
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
  );
};

export default Notification;
