/**
 * Asked once an order's status is saved as Shipped: send the buyer a Q-Mail
 * about it (orders/shippedMail.ts)? The message is ready, with the tracking
 * number and the note, and can be changed first. Not now closes it; the
 * status is already saved either way.
 */
import { useState } from "react";
import { useDispatch } from "react-redux";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import ShortUniqueId from "short-unique-id";
import { ResponsiveDialog } from "../../../components/common/mobile";
import { setNotification } from "../../../state/features/notificationsSlice";
import { sendShippedMail, shippedMailText } from "../../../orders/shippedMail";
import type { Tracking } from "../../../orders/tracking";
import type { Order } from "../../../state/features/orderSlice";

const mailUid = new ShortUniqueId();

export function ShippedMailDialog({
  order,
  seller,
  sellerPublicKey,
  tracking,
  note,
  onClose,
}: {
  order: Order;
  seller: string;
  sellerPublicKey: string;
  tracking: Tracking | null;
  note: string;
  onClose: () => void;
}) {
  const dispatch = useDispatch();
  const [text, setText] = useState(() => shippedMailText(order, tracking, note));
  // One uid for this dialog: sending again after a failure replaces, never adds a second mail.
  const [uid] = useState(() => mailUid());
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async () => {
    setSending(true);
    setFailed(false);
    const result = await sendShippedMail({ order, text, seller, sellerPublicKey, uid });
    setSending(false);
    if (result === "sent") {
      dispatch(setNotification({ alertType: "success", msg: `Q-Mail sent to ${order.user}` }));
      onClose();
    } else if (result === "timeout") {
      dispatch(setNotification({ alertType: "info", msg: "Hub didn't answer in time. If you accepted, the Q-Mail is on its way." }));
      onClose();
    } else if (result === "failed") setFailed(true);
  };

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={`Tell ${order.user} it's shipped?`}
      dismissible={!sending}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={sending} sx={{ minHeight: 44 }}>
            Not now
          </Button>
          <Button variant="contained" onClick={() => void send()} disabled={sending || !text.trim()} sx={{ minHeight: 44 }}>
            {sending ? "Sending…" : "Send Q-Mail"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography>The status is saved. You can also send this as a Q-Mail, so they see it in their inbox.</Typography>
        <TextField label="Message" value={text} onChange={(e) => setText(e.target.value)} multiline minRows={6} maxRows={14} fullWidth disabled={sending} />
        <Typography variant="body2" color="text.secondary">
          Only you and {order.user} can read it. Hub asks you to confirm it and its fee.
        </Typography>
        {failed && (
          <Alert severity="error" role="alert">
            The Q-Mail couldn&apos;t be sent. Try again.
          </Alert>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
