/**
 * How an order was paid. QORT and Qortal assets: the transaction signature
 * with Copy, and "Transaction details" read from the node on demand
 * (`/transactions/signature/<sig>`): amount, recipient, sender, time and
 * block, plus anything that doesn't match the order. Other coins: the
 * address paid and the transaction id when Hub gave one, and always the
 * caveat that they can't be checked here. Display only.
 *
 * For the seller, the coin comes from orders/useOrderCoin.ts (never the
 * buyer's own name for an asset), and what the seller's shop accepts is
 * checked first: an asset or coin the shop doesn't take, a coin the app
 * doesn't know, an address that isn't the shop's.
 */
import { useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import type { RootState } from "../../../state/store";
import type { Order } from "../../../state/features/orderSlice";
import { AmountTag } from "../../../components/money/PriceTag";
import { copyText } from "../../../utils/clipboard";
import { fetchPaymentTransaction, nameOwner, type PaymentTransaction } from "../../../orders/reads";
import { paymentWarnings, shopPaymentWarnings, transactionCoin, paymentNotes } from "../../../orders/payment";
import { formatOrderDate } from "../../../orders/format";
import type { OrderCoinView } from "../../../orders/useOrderCoin";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ContentCopyOutlinedIcon />}
        aria-label={label}
        onClick={async () => setState((await copyText(text)) ? "copied" : "failed")}
        sx={{ minHeight: 44, flexShrink: 0 }}
      >
        Copy
      </Button>
      <Typography component="span" role="status" variant="body2" color="text.secondary">
        {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy: select the text instead" : ""}
      </Typography>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "140px 1fr" }, gap: { xs: 0, sm: 2 }, py: 0.75 }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}>
        {children}
      </Typography>
    </Box>
  );
}

const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, overflowWrap: "anywhere" } as const;

type TxState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; tx: PaymentTransaction; warnings: string[]; notes: string[] };

/** "Gold (asset #42)", or "Asset #42" while its name isn't known. */
function assetText(name: string, assetId: number): string {
  return name === `Asset #${assetId}` ? name : `${name} (asset #${assetId})`;
}

export function PaymentDetails({
  order,
  role,
  coin: coinView,
}: {
  order: Order;
  role: "buyer" | "seller";
  /** The order's coin as this role sees it (orders/useOrderCoin.ts). */
  coin: OrderCoinView;
}) {
  const me = useSelector((state: RootState) => state.auth.user);
  const otherOrdersWithSameSignature = useSelector((state: RootState) => {
    const sig = order.payment?.transactionSignature;
    if (!sig || role !== "seller") return 0;
    return Object.values(state.order.hashMapOrders).filter((o) => o.id !== order.id && o.payment?.transactionSignature === sig)
      .length;
  });
  const { summary, coin, settings: coinSettings, label, shop } = coinView;
  // The seller's own shop says what it accepts; the buyer's screens don't check their own order.
  const shopWarnings = role === "seller" ? shopPaymentWarnings(order.payment, shop) : [];
  const paidIn =
    summary.kind === "asset" && summary.assetId !== null
      ? assetText(role === "buyer" ? summary.assetName || label : label, summary.assetId)
      : label;
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const loadTransaction = async () => {
    if (!summary.signature) return;
    setTx({ kind: "loading" });
    try {
      const found = await fetchPaymentTransaction(summary.signature);
      // Who should have sent and received it: the names' owners, looked up now.
      const [sellerAddress, buyerAddress] = await Promise.all([
        role === "seller"
          ? Promise.resolve(me?.address ?? null)
          : order.sellerName
          ? nameOwner(order.sellerName).catch(() => null)
          : null,
        role === "buyer" ? Promise.resolve(me?.address ?? null) : nameOwner(order.user).catch(() => null),
      ]);
      setTx({
        kind: "ready",
        tx: found,
        warnings: paymentWarnings(found, order.payment, { sellerAddress, buyerAddress, shop }),
        notes: paymentNotes(found, { buyerAddress }),
      });
    } catch {
      setTx({ kind: "error" });
    }
  };

  return (
    <Box>
      {shopWarnings.map((w) => (
        <Alert key={w} severity="warning" sx={{ mb: 1 }}>
          {w} Make sure you received what the order is worth before you ship.
        </Alert>
      ))}
      <Box component="dl" sx={{ m: 0 }}>
        <Field label="Paid in">{paidIn}</Field>
        <Field label="Total paid">
          <AmountTag value={order.payment?.total ?? order.details?.totalPrice} coin={coin} shop={coinSettings} size="small" />
        </Field>
        {summary.addressPaid && (
          <Field label="Paid to">
            <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Box component="span" sx={mono}>
                {summary.addressPaid}
              </Box>
              <CopyButton text={summary.addressPaid} label="Copy the address paid" />
            </Box>
          </Field>
        )}
        {summary.txid && (
          <Field label="Transaction id">
            <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Box component="span" sx={mono}>
                {summary.txid}
              </Box>
              <CopyButton text={summary.txid} label="Copy the transaction id" />
            </Box>
          </Field>
        )}
        {summary.kind === "foreign" && (
          // Always: a transaction id in the order is only what the order says.
          <Field label="Transaction">
            {summary.known
              ? `${label} payments can't be checked here. Check your ${label} wallet for the payment${
                  summary.addressPaid ? " to the address above" : ""
                }${summary.txid ? "; the transaction id is the one the order gives" : ""}.`
              : "This payment can't be checked here."}
          </Field>
        )}
        {summary.signature ? (
          <Field label="Signature">
            <Box component="span" sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
              <Box component="span" sx={mono}>
                {summary.signature}
              </Box>
              <Box component="span" sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <CopyButton text={summary.signature} label="Copy the payment signature" />
                {tx.kind !== "ready" && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={loadTransaction}
                    aria-disabled={tx.kind === "loading" || undefined}
                    sx={{ minHeight: 44 }}
                  >
                    {tx.kind === "loading" ? "Loading…" : tx.kind === "error" ? "Try again" : "Transaction details"}
                  </Button>
                )}
              </Box>
            </Box>
          </Field>
        ) : (
          (summary.kind === "qort" || summary.kind === "asset") && <Field label="Signature">Not recorded in this order.</Field>
        )}
      </Box>
      {otherOrdersWithSameSignature > 0 && (
        <Alert severity="warning" sx={{ my: 1 }}>
          Another order you received names the same payment.
        </Alert>
      )}
      {tx.kind === "loading" && (
        <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
          <CircularProgress size={16} aria-hidden />
          <Typography variant="body2" color="text.secondary">
            Reading the transaction from your node…
          </Typography>
        </Box>
      )}
      {tx.kind === "error" && (
        <Alert severity="info" sx={{ my: 1 }}>
          This transaction isn't on your node. It may not be confirmed yet.
        </Alert>
      )}
      {tx.kind === "ready" && (
        <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
          <Typography component="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Transaction details
          </Typography>
          {tx.warnings.map((w) => (
            <Alert key={w} severity="warning" sx={{ my: 1 }}>
              {w}
            </Alert>
          ))}
          {tx.notes.map((n) => (
            <Typography key={n} variant="body2" color="text.secondary" sx={{ my: 1 }}>
              {n}
            </Typography>
          ))}
          <Box component="dl" sx={{ m: 0 }}>
            {tx.tx.amount !== undefined && (
              <Field label="Amount">
                {/* In the coin the node says moved, named by the node. */}
                <AmountTag
                  value={tx.tx.amount}
                  coin={transactionCoin(tx.tx)?.coin ?? coin}
                  shop={transactionCoin(tx.tx)?.settings ?? coinSettings}
                  size="small"
                />
              </Field>
            )}
            {tx.tx.recipient && (
              <Field label="Sent to">
                <Box component="span" sx={mono}>
                  {tx.tx.recipient}
                </Box>
              </Field>
            )}
            {tx.tx.creatorAddress && (
              <Field label="Sent from">
                <Box component="span" sx={mono}>
                  {tx.tx.creatorAddress}
                </Box>
              </Field>
            )}
            {tx.tx.timestamp !== undefined && <Field label="Time">{formatOrderDate(tx.tx.timestamp)}</Field>}
            <Field label="Block">
              {tx.tx.blockHeight ? `Confirmed in block ${tx.tx.blockHeight.toLocaleString("en-US")}` : "Not confirmed yet"}
            </Field>
            {tx.tx.fee !== undefined && <Field label="Fee">{`${tx.tx.fee} QORT`}</Field>}
          </Box>
        </Box>
      )}
    </Box>
  );
}
