/**
 * One order, for its buyer (My orders) or its seller (the shop's Orders):
 * full screen on phones (ResponsiveDialog). What was bought, with pictures,
 * quantities, unit and line amounts and the total in the order's coin; how
 * it was paid (PaymentDetails); where it goes for a physical order; Message
 * the other side (Q-Mail+); the status and the seller's note. The seller
 * changes the status here: shown at once, put back if the publish doesn't
 * happen, and a decline in Hub's dialog is quiet.
 *
 * When the order's list hasn't read its status (or the dialog is opened on
 * its own), the dialog reads it: a search for the status document under the
 * seller's name, then FETCH + DECRYPT_DATA as the original
 * (orders/loader.ts ensureOrderStatus).
 */
import { useEffect, useState, type ReactNode } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Divider, Link, Skeleton, Typography } from "@mui/material";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import type { RootState } from "../../../state/store";
import type { Order, OrderStatusInfo } from "../../../state/features/orderSlice";
import { setNotification } from "../../../state/features/notificationsSlice";
import { ResponsiveDialog } from "../../../components/common/mobile";
import { NameAvatar } from "../../../components/common/NameAvatar";
import { AmountTag } from "../../../components/money/PriceTag";
import { mailToLink, productPath, storePath } from "../../../qdn/links";
import { ensureOrderStatus, type OrderStore } from "../../../orders/loader";
import { sendOrderStatus } from "../../../orders/statusUpdate";
import { normalizeStatus } from "../../../orders/status";
import {
  deliveryLines,
  formatOrderDate,
  isDigitalOrder,
  orderCoin,
  orderCoinSettings,
  orderItems,
  orderTotal,
  type OrderItem,
} from "../../../orders/format";
import { OrderStatusChip } from "../../../orders/components/OrderStatusChip";
import { PaymentDetails } from "./PaymentDetails";
import { StatusEditor, type StatusDraft } from "./StatusEditor";

export interface ShowOrderProps {
  open: boolean;
  onClose: () => void;
  /** The opened order (null renders nothing). */
  order: Order | null;
  role: "buyer" | "seller";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography
        component="h3"
        sx={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "text.secondary" }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function ItemRow({ item, order, sellerName }: { item: OrderItem; order: Order; sellerName: string }) {
  const coin = orderCoin(order);
  const coinSettings = orderCoinSettings(order);
  const owner = item.product?.user || sellerName;
  const storeId = item.product?.storeId;
  const to =
    owner && storeId && item.product?.id && item.catalogueId
      ? productPath(owner, storeId, item.product.id, item.catalogueId)
      : null;
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Box component="li" sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", minWidth: 0 }}>
      {item.image && !imageFailed ? (
        <Box
          component="img"
          src={item.image}
          alt={item.title}
          loading="lazy"
          onError={() => setImageFailed(true)}
          sx={{ width: 56, height: 56, borderRadius: 1.5, objectFit: "cover", flexShrink: 0, bgcolor: "action.hover" }}
        />
      ) : (
        <Box aria-hidden sx={{ width: 56, height: 56, borderRadius: 1.5, flexShrink: 0, bgcolor: "action.hover" }} />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {to ? (
          <Link
            component={RouterLink}
            to={to}
            underline="always"
            sx={{ fontWeight: 600, overflowWrap: "anywhere", textUnderlineOffset: "3px" }}
          >
            {item.title}
          </Link>
        ) : (
          <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{item.title}</Typography>
        )}
        <Typography
          variant="body2"
          color="text.secondary"
          component="div"
          sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}
        >
          {item.quantity} ×
          <AmountTag value={item.pricePerUnit} coin={coin} shop={coinSettings} size="small" sx={{ fontWeight: 500 }} />
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0, textAlign: "right" }}>
        <AmountTag value={item.totalProductPrice} coin={coin} shop={coinSettings} size="small" />
      </Box>
    </Box>
  );
}

function sameDraft(draft: StatusDraft, status: OrderStatusInfo | null): boolean {
  if (!status || status.state !== "known") return false;
  return normalizeStatus(draft.status) === normalizeStatus(status.status) && draft.note === status.note;
}

export function ShowOrder({ open, onClose, order, role }: ShowOrderProps) {
  const dispatch = useDispatch();
  const store: OrderStore = useStore<RootState>();
  const me = useSelector((state: RootState) => state.auth.user);
  const status = useSelector((state: RootState) => (order ? state.order.statuses[order.id] ?? null : null));
  const sellerName = role === "seller" ? me?.name || order?.sellerName || "" : order?.sellerName || "";

  // The status, when the list hasn't read it (pinned read: ShowOrder.pin.test.tsx).
  useEffect(() => {
    if (open && order && sellerName) void ensureOrderStatus(store, order, sellerName);
  }, [open, order, sellerName, store]);

  // The seller's draft starts from the status as read, and again whenever it is read anew.
  const draftKey = status ? `${status.state}:${status.updated}` : "loading";
  const [draftState, setDraftState] = useState<{ key: string; orderId: string; draft: StatusDraft } | null>(null);
  const draft: StatusDraft =
    draftState && draftState.key === draftKey && draftState.orderId === order?.id
      ? draftState.draft
      : {
          status: status?.state === "known" ? normalizeStatus(status.status) ?? "Received" : "Received",
          note: status?.note ?? "",
        };
  const setDraft = (next: StatusDraft) => setDraftState({ key: draftKey, orderId: order?.id ?? "", draft: next });

  if (!order) return null;

  const items = orderItems(order);
  const coin = orderCoin(order);
  const coinSettings = orderCoinSettings(order);
  const digital = isDigitalOrder(order);
  const address = deliveryLines(order);
  const other = role === "seller" ? order.user : order.sellerName || "";
  const storeId = items.find((i) => i.product?.storeId)?.product?.storeId as string | undefined;
  const sending = !!status?.sending;

  const update = async () => {
    if (sending || !me?.name || !me.publicKey) return;
    const result = await sendOrderStatus(store, {
      order,
      seller: me.name,
      sellerPublicKey: me.publicKey,
      status: draft.status,
      note: draft.note,
    });
    if (result === "sent") dispatch(setNotification({ alertType: "success", msg: "Status updated" }));
    else if (result === "timeout") {
      dispatch(
        setNotification({
          alertType: "info",
          msg: "Hub didn't answer in time. If you accepted, the new status shows after a refresh.",
        })
      );
    } else if (result === "failed")
      dispatch(setNotification({ alertType: "error", msg: "Couldn't update the status. Try again." }));
  };

  const title = role === "seller" ? `Order from ${order.user}` : `Order at ${order.storeName || order.sellerName || "a shop"}`;
  const canUpdate = role === "seller" && !!status && !sending && !sameDraft(draft, status);

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="md"
      actions={
        role === "seller" ? (
          <Button variant="contained" onClick={update} disabled={!canUpdate} sx={{ minHeight: 44 }}>
            {sending ? "Updating…" : "Update status"}
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <NameAvatar name={other || "?"} size={44} />
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
              {role === "seller" ? order.user : order.storeName || order.sellerName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatOrderDate(order.created)}
              {role === "buyer" && order.sellerName && order.storeName ? ` · by ${order.sellerName}` : ""}
            </Typography>
          </Box>
          <OrderStatusChip status={status} role={role} size="medium" />
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {other && (
            <Button
              component="a"
              href={mailToLink(other)}
              className="qortal-link"
              variant="outlined"
              startIcon={<MailOutlineOutlinedIcon />}
              sx={{ minHeight: 44 }}
            >
              {role === "seller" ? `Message ${order.user}` : `Message ${order.sellerName}`}
            </Button>
          )}
          {role === "buyer" && order.sellerName && storeId && (
            <Button
              component={RouterLink}
              to={storePath(order.sellerName, storeId)}
              variant="outlined"
              startIcon={<StorefrontOutlinedIcon />}
              sx={{ minHeight: 44 }}
            >
              Visit shop
            </Button>
          )}
        </Box>

        <Section title="Status">
          {role === "seller" ? (
            status ? (
              <StatusEditor draft={draft} onChange={setDraft} disabled={sending} />
            ) : (
              <Box role="status" aria-label="Loading the status">
                <Skeleton variant="rounded" height={44} />
                <Skeleton variant="rounded" height={72} sx={{ mt: 2 }} />
              </Box>
            )
          ) : status?.state === "known" && status.note ? (
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
              <Typography variant="body2" color="text.secondary">
                Note from the seller
              </Typography>
              <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{status.note}</Typography>
            </Box>
          ) : status?.state === "error" ? (
            <Typography variant="body2" color="text.secondary">
              The seller's status update couldn't be read.
            </Typography>
          ) : status ? (
            <Typography variant="body2" color="text.secondary">
              {normalizeStatus(status.status) === "Received"
                ? "The seller hasn't updated this order yet."
                : "No note from the seller."}
            </Typography>
          ) : (
            <Skeleton width="60%" />
          )}
        </Section>

        <Section title={`Items (${items.length})`}>
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {items.map((item) => (
              <ItemRow key={item.productId} item={item} order={order} sellerName={order.sellerName || ""} />
            ))}
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>Total</Typography>
            <AmountTag value={orderTotal(order)} coin={coin} shop={coinSettings} size="large" />
          </Box>
        </Section>

        <Section title="Payment">
          <PaymentDetails order={order} role={role} />
        </Section>

        <Section title="Delivery">
          {digital ? (
            <Typography variant="body2" color="text.secondary">
              Digital order: nothing to ship.
            </Typography>
          ) : address.length > 0 ? (
            <Box component="dl" sx={{ m: 0 }}>
              {address.map((line) => (
                <Box
                  key={line.label}
                  sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "140px 1fr" }, gap: { xs: 0, sm: 2 }, py: 0.5 }}
                >
                  <Typography component="dt" variant="body2" color="text.secondary">
                    {line.label}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                    {line.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No delivery address in this order.
            </Typography>
          )}
        </Section>

        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          Order {order.id}
        </Typography>
      </Box>
    </ResponsiveDialog>
  );
}
