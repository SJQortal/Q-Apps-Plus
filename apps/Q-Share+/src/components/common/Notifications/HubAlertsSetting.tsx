import { useEffect, useReducer, useState, type ElementType } from "react";
import { Box, Switch, Typography } from "@mui/material";
import { useDispatch } from "react-redux";
import { useNotificationAccount } from "../../../hooks/useNotificationChecks";
import { setNotification } from "../../../state/features/notificationsSlice";
import { loadActivity } from "../../../utils/notifications/activity";
import {
  HUB_REPLY_RULES,
  HUB_SHARE_RULES,
  disableHubAlerts,
  enableHubAlerts,
  hubAlertsAvailable,
  readHubAlerts,
} from "../../../utils/notifications/hubAlerts";

/**
 * Settings → Notifications → Alerts while Q-Share+ is closed. Asks Hub
 * whether it has app alerts at all; turning it on lets Hub slide down its
 * permission banner, then hands Hub the rules. On this device only, per
 * account. `row` is the Settings page's row layout.
 */
export function HubAlertsSetting({ row: Row }: { row: ElementType }) {
  const dispatch = useDispatch();
  const account = useNotificationAccount();
  const address = account?.address;
  const [available, setAvailable] = useState<boolean | null>(null);
  // Read from storage each render: enabling and disabling write it, then re-render.
  const enabled = address ? readHubAlerts(address).enabled : false;
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    hubAlertsAvailable().then((yes) => active && setAvailable(yes));
    return () => {
      active = false;
    };
  }, []);

  if (!account) return null;

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        const ok = await enableHubAlerts(account.address, await loadActivity(account.names));
        dispatch(
          setNotification(
            ok
              ? { msg: "Hub will alert you about new comments", alertType: "success" }
              : { msg: "Hub alerts stay off: Hub's permission wasn't given", alertType: "info" }
          )
        );
      } else {
        await disableHubAlerts(account.address);
      }
    } catch {
      dispatch(setNotification({ msg: "Hub didn't answer. Try again in a moment.", alertType: "error" }));
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <Row>
      <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>Alerts while Q-Share+ is closed</Typography>
        <Typography variant="body2" color="text.secondary">
          {available === false
            ? "This Hub doesn't offer app alerts."
            : `Qortal Hub tells you about new comments on your ${HUB_SHARE_RULES} newest shares and replies to your ${HUB_REPLY_RULES} newest comments, even when Q-Share+ isn't open. Hub asks you to allow it first. In GO, alerts come while GO keeps running in the background. Collection adds show in the bell next time you open Q-Share+.`}
        </Typography>
      </Box>
      <Switch
        checked={enabled}
        disabled={available !== true || busy}
        onChange={(e) => void toggle(e.target.checked)}
        slotProps={{ input: { "aria-label": "Alerts while Q-Share+ is closed" } }}
      />
    </Row>
  );
}
