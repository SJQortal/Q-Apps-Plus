/**
 * Orders whose payment went through (or may have) but that aren't recorded
 * on QDN yet (money/pendingOrders.ts). Shown first on the cart page and as
 * the result of a checkout that didn't finish. Every action here finishes
 * the order with the payment already made; none of them pays again:
 *
 * - paid → Finish order (recordOrder; a physical order asks for the address
 *   again after a reload, since addresses are never stored);
 * - unconfirmed, QORT or an asset → Check again: the buyer's recent payments
 *   are searched (findUnconfirmedPayment, which leaves out payments other
 *   orders use), and a single match is confirmed and recorded; when several
 *   fit, the buyer picks one;
 * - unconfirmed, another coin (the node can't see it) → "I paid — record the
 *   order", behind a confirmation;
 * - unconfirmed → "I wasn't charged — remove", behind a confirmation.
 */
import { useId, useState, type ReactNode } from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import { AmountTag } from "../../components/money/PriceTag";
import { ResponsiveDialog } from "../../components/common/mobile";
import { assetIdOf, isForeignTicker, type ShopCoinSettings } from "../../money/coins";
import {
  confirmPendingPayment,
  findUnconfirmedPayment,
  recordOrder,
  type PaymentCandidate,
  type PaymentSearch,
} from "../../money/checkout";
import { digitalDelivery, missingDeliveryFields, orderLines, type DeliveryInput } from "../../money/order";
import {
  pendingDelivery,
  rememberDelivery,
  removePendingOrder,
  type PendingOrder,
} from "../../money/pendingOrders";
import { errorMessage } from "../../qdn/hubErrors";
import { LazyDeliveryForm } from "./LazyDeliveryForm";
import { emptyDelivery, focusFirstMissing } from "./delivery";
import { itemCount, shortAddress } from "./cartLines";

/**
 * The coin settings a pending order's payment record needs: only an asset's
 * name, which checkout kept as the order's `currencyLabel`.
 */
export function pendingShopSettings(order: PendingOrder): ShopCoinSettings {
  const assetId = assetIdOf(order.coin);
  return assetId === null ? {} : { acceptedAssets: [{ id: assetId, name: order.currencyLabel }] };
}

/** QORT payments and asset transfers can be looked up on chain; other coins can't from here. */
export function canSearchPayment(order: PendingOrder): boolean {
  return order.coin === "QORT" || assetIdOf(order.coin) !== null;
}

type Busy = "searching" | "checking" | "recording" | null;
type Note = { severity: "info" | "warning" | "error"; text: string } | null;

const BUSY_TEXT: Record<Exclude<Busy, null>, string> = {
  searching: "Looking for your payment…",
  checking: "Checking whether the order is already recorded…",
  recording: "Recording your order: confirm in Hub…",
};

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

/** Asks for the delivery address of a paid physical order, then records it. */
function AddressDialog({
  order,
  onCancel,
  onSubmit,
}: {
  order: PendingOrder;
  onCancel: () => void;
  onSubmit: (delivery: DeliveryInput) => void;
}) {
  const [delivery, setDelivery] = useState<DeliveryInput>(() => emptyDelivery(order.buyer.name));
  const [showErrors, setShowErrors] = useState(false);
  const prefix = `pending-${order.orderUid}`;
  const submit = () => {
    if (missingDeliveryFields(delivery).length > 0) {
      setShowErrors(true);
      focusFirstMissing(prefix, delivery);
      return;
    }
    onSubmit(delivery);
  };
  return (
    <ResponsiveDialog
      open
      onClose={onCancel}
      title="Delivery address"
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" onClick={submit}>
            Record order
          </Button>
        </>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Addresses aren't kept on this device, so enter it once more for {order.store.title || "the shop"}.
      </Typography>
      <LazyDeliveryForm value={delivery} onChange={setDelivery} showErrors={showErrors} idPrefix={prefix} />
    </ResponsiveDialog>
  );
}

function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveDialog
      open
      onClose={onCancel}
      title={title}
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="contained" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </ResponsiveDialog>
  );
}

export function PendingOrderCard({
  order,
  onRecorded,
}: {
  order: PendingOrder;
  /** The order is on QDN now (it has left the pending list). */
  onRecorded: (order: PendingOrder) => void;
}) {
  const titleId = useId();
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<Note>(null);
  const [addressFor, setAddressFor] = useState<PendingOrder | null>(null);
  const [confirming, setConfirming] = useState<"paid" | "remove" | null>(null);
  /** Payments that could each be this order's, for the buyer to pick from. */
  const [choices, setChoices] = useState<PaymentCandidate[] | null>(null);

  const settings = pendingShopSettings(order);
  const paid = order.state === "paid";
  const seller = order.store.owner;
  const shopTitle = order.store.title || "this shop";
  const lines = orderLines(order.details);
  const items = itemCount(lines.map(([, line]) => line));
  const foreign = isForeignTicker(order.coin);
  const amount = <AmountTag value={order.amount} coin={order.coin} shop={settings} size="small" />;

  const record = async (target: PendingOrder, delivery: DeliveryInput) => {
    setBusy("checking");
    setNote(null);
    const result = await recordOrder(target, delivery, {
      onStep: (step) => setBusy(step === "checking" ? "checking" : "recording"),
    });
    setBusy(null);
    if (result.kind === "done") onRecorded(target);
    else if (result.kind === "not-recorded" || result.kind === "failed") setNote({ severity: "warning", text: result.message });
  };

  /** Records a paid order, asking for the address first when this visit doesn't have it. */
  const finish = (target: PendingOrder) => {
    const delivery = pendingDelivery(target.orderUid) ?? (target.isDigital ? digitalDelivery(target.buyer.name) : undefined);
    if (!delivery) {
      setAddressFor(target);
      return;
    }
    void record(target, delivery);
  };

  const checkAgain = async () => {
    setBusy("searching");
    setNote(null);
    setChoices(null);
    let search: PaymentSearch;
    try {
      search = await findUnconfirmedPayment(order);
    } catch (error) {
      setBusy(null);
      setNote({ severity: "error", text: `Couldn't look up your payments: ${errorMessage(error, "the node didn't answer")}. Try again.` });
      return;
    }
    setBusy(null);
    if (search.kind === "none") {
      setNote({
        severity: "info",
        text: "No matching payment yet. If Hub showed it as sent, check again in a minute. Don't pay again.",
      });
      return;
    }
    if (search.kind === "several") {
      // Never one picked on its own: it may be another order's payment.
      setChoices(search.candidates);
      return;
    }
    finish(confirmPendingPayment(order, settings, { signature: search.signature }));
  };

  const pickCandidate = (candidate: PaymentCandidate) => {
    setChoices(null);
    finish(confirmPendingPayment(order, settings, { signature: candidate.signature }));
  };

  const confirmPaid = () => {
    setConfirming(null);
    finish(confirmPendingPayment(order, settings, {}));
  };

  const remove = () => {
    setConfirming(null);
    removePendingOrder(order.buyer.name, order.orderUid);
  };

  return (
    <Paper variant="outlined" component="article" aria-labelledby={titleId} sx={{ p: 2, borderRadius: 2 }}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Box sx={{ color: paid ? "primary.main" : "warning.main", mt: "2px" }} aria-hidden>
          {paid ? <HourglassEmptyIcon /> : <HelpOutlineIcon />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id={titleId} component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
            {paid ? "Payment sent — the order isn't recorded yet" : "Payment not confirmed"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {shopTitle} · {items} {items === 1 ? "item" : "items"} · {formatDate(order.created)}
          </Typography>
          <Typography variant="body2" component="div" sx={{ mt: 1, lineHeight: 1.9 }}>
            {paid ? "You paid" : "Hub didn't confirm your payment of"} {amount} to {seller}
            {foreign && <> ({order.coin} address {shortAddress(order.recipient)})</>}.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {paid
              ? "Finish the order to send it to the seller. You won't pay again."
              : canSearchPayment(order)
                ? "Check whether it went through before doing anything else."
                : `Your node can't see ${order.coin} payments. Check your ${order.coin} wallet: if it shows this payment, record the order.`}
          </Typography>
          {busy ? (
            <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.5 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">{BUSY_TEXT[busy]}</Typography>
            </Box>
          ) : note ? (
            <Alert severity={note.severity} sx={{ mt: 1.5 }}>
              {note.text}
            </Alert>
          ) : order.lastError ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {order.lastError}
            </Typography>
          ) : null}
          {choices && !busy && (
            <Box sx={{ mt: 1.5 }}>
              <Alert severity="info">
                More than one payment of {amount} to {seller} was made after this checkout
                started. Pick the one that paid for this order; your wallet's history shows the time of each.
              </Alert>
              <Stack sx={{ mt: 1, gap: 1, "& .MuiButton-root": { minHeight: 44, justifyContent: "flex-start", textAlign: "left" } }}>
                {choices.map((candidate) => (
                  <Button key={candidate.signature} variant="outlined" onClick={() => pickCandidate(candidate)}>
                    Paid {formatDate(candidate.timestamp)} · {shortAddress(candidate.signature)}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}
          <Stack direction="row" sx={{ mt: 1.5, flexWrap: "wrap", gap: 1, "& .MuiButton-root": { minHeight: 44 } }}>
            {paid && (
              <Button variant="contained" onClick={() => finish(order)} disabled={busy !== null}>
                Finish order
              </Button>
            )}
            {!paid && canSearchPayment(order) && (
              <Button variant="contained" onClick={checkAgain} disabled={busy !== null}>
                Check again
              </Button>
            )}
            {!paid && !canSearchPayment(order) && (
              <Button variant="contained" onClick={() => setConfirming("paid")} disabled={busy !== null}>
                I paid — record the order
              </Button>
            )}
            {!paid && (
              <Button onClick={() => setConfirming("remove")} disabled={busy !== null}>
                I wasn't charged — remove
              </Button>
            )}
          </Stack>
        </Box>
      </Box>

      {addressFor && (
        <AddressDialog
          order={addressFor}
          onCancel={() => setAddressFor(null)}
          onSubmit={(delivery) => {
            const target = addressFor;
            setAddressFor(null);
            rememberDelivery(target.orderUid, delivery);
            void record(target, delivery);
          }}
        />
      )}
      {confirming === "paid" && (
        <ConfirmDialog
          title="Record the order?"
          confirmLabel="Record the order"
          onCancel={() => setConfirming(null)}
          onConfirm={confirmPaid}
        >
          <Typography variant="body2" component="div" sx={{ lineHeight: 1.9 }}>
            Only if your {order.coin} wallet shows a payment of {amount} to {shortAddress(order.recipient)}.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            The order tells {seller} you paid; they check it against their wallet.
          </Typography>
        </ConfirmDialog>
      )}
      {confirming === "remove" && (
        <ConfirmDialog
          title="Remove this order?"
          confirmLabel="Remove"
          cancelLabel="Keep it"
          onCancel={() => setConfirming(null)}
          onConfirm={remove}
        >
          <Typography variant="body2" component="div" sx={{ lineHeight: 1.9 }}>
            Only if your wallet shows no payment of {amount} to {foreign ? shortAddress(order.recipient) : seller}.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            If you did pay, {seller} won't hear about this order once it's removed.
          </Typography>
        </ConfirmDialog>
      )}
    </Paper>
  );
}

/** The pending orders, first on the cart page; nothing when there are none. */
export function PendingOrdersPanel({
  orders,
  onRecorded,
}: {
  orders: PendingOrder[];
  onRecorded: (order: PendingOrder) => void;
}) {
  const headingId = useId();
  if (orders.length === 0) return null;
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ mb: 3 }}>
      <Typography id={headingId} component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
        Orders to finish
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        These payments went through, or may have. Finish them here: you won't be asked to pay again.
      </Typography>
      <Stack sx={{ gap: 1.5 }}>
        {orders.map((order) => (
          <PendingOrderCard key={order.orderUid} order={order} onRecorded={onRecorded} />
        ))}
      </Stack>
    </Box>
  );
}
