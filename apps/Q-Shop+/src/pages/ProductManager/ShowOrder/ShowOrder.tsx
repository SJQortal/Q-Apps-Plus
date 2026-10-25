/**
 * One order, for its buyer (My orders) or its seller (the shop's Orders):
 * full screen on phones (ResponsiveDialog). What was bought, with pictures,
 * quantities, unit and line amounts and the total in the order's coin; how
 * it was paid (PaymentDetails); where it goes for a physical order; Message
 * the other side (Q-Mail); the status and the seller's note. The seller
 * changes the status here: shown at once, put back if the publish doesn't
 * happen, and a decline in Hub's dialog is quiet.
 *
 * When the order's list hasn't read its status (or the dialog is opened on
 * its own), the dialog reads it: a search for the status document under the
 * seller's name, then FETCH + DECRYPT_DATA as the original
 * (orders/loader.ts ensureOrderStatus).
 *
 * Once the seller has shipped it, the buyer can mark it delivered (a
 * digital order: received, at once; Simon, 2026-10-24), with a small
 * publish of their own (orders/delivered.ts), and is then asked for a
 * review of the shop, which needs it. Both sides see "Delivered" from then on, unless
 * the seller refunds it.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Divider, Link, Rating, Skeleton, Typography } from "@mui/material";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import type { RootState } from "../../../state/store";
import type { Order, OrderStatusInfo } from "../../../state/features/orderSlice";
import { setNotification } from "../../../state/features/notificationsSlice";
import { ResponsiveDialog } from "../../../components/common/mobile";
import { NameAvatar } from "../../../components/common/NameAvatar";
import { AmountTag } from "../../../components/money/PriceTag";
import { mailToLink, productPath, storePath } from "../../../qdn/links";
import { ensureDelivered, ensureOrderStatus, type OrderStore } from "../../../orders/loader";
import { markDelivered } from "../../../orders/delivered";
import { sameName } from "../../../orders/reads";
import { sendOrderStatus } from "../../../orders/statusUpdate";
import { normalizeStatus, shownStatus } from "../../../orders/status";
import type { Tracking } from "../../../orders/tracking";
import { copyText } from "../../../utils/clipboard";
import { deliveryLines, formatOrderDate, isDigitalOrder, orderDelivery, orderItems, orderTotal, type OrderItem } from "../../../orders/format";
import { useOrderCoinView } from "../../../orders/useOrderCoin";
import type { ShopCoinSettings } from "../../../money/coins";
import { OrderStatusChip } from "../../../orders/components/OrderStatusChip";
import { PaymentDetails } from "./PaymentDetails";
import { StatusEditor, type StatusDraft } from "./StatusEditor";
import { AddReview } from "../../Store/StoreReviews/AddReview/AddReview";
import { StoreReviewCard } from "../../Store/StoreReviews/StoreReviewCard";
import { useMyShopReview, useShopReviews } from "../../Store/useShopData";
import { formatReviewDate } from "../../Store/StoreReviews/StoreReviewCard";
import type { ShopReview } from "../../Store/reviewsData";

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

function ItemRow({
  item,
  coin,
  coinSettings,
  sellerName,
}: {
  item: OrderItem;
  coin: string;
  coinSettings: ShopCoinSettings | null;
  sellerName: string;
}) {
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
  const sameTracking =
    normalizeStatus(draft.status) !== "Shipped" ||
    (draft.trackingNumber.trim() === (status.tracking?.number ?? "") && draft.carrier.trim() === (status.tracking?.carrier ?? ""));
  return normalizeStatus(draft.status) === normalizeStatus(status.status) && draft.note === status.note && sameTracking;
}

/** A shipped order's carrier and tracking number, with Copy (orders/tracking.ts). */
function TrackingBox({ tracking }: { tracking: Tracking }) {
  const [copied, setCopied] = useState(false);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2, border: 1, borderColor: "divider", flexWrap: "wrap" }}>
      <LocalShippingOutlinedIcon aria-hidden sx={{ color: "text.secondary" }} />
      <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {tracking.carrier ? `Tracking with ${tracking.carrier}` : "Tracking number"}
        </Typography>
        <Typography sx={{ fontFamily: "monospace", fontSize: 16, overflowWrap: "anywhere" }}>{tracking.number}</Typography>
      </Box>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={copied ? <CheckCircleOutlinedIcon /> : <ContentCopyOutlinedIcon />}
        onClick={async () => setCopied(await copyText(tracking.number))}
        aria-label={copied ? "Tracking number copied" : "Copy the tracking number"}
        sx={{ minHeight: 44 }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </Box>
  );
}

export function ShowOrder({ open, onClose, order, role }: ShowOrderProps) {
  const dispatch = useDispatch();
  const store: OrderStore = useStore<RootState>();
  const me = useSelector((state: RootState) => state.auth.user);
  const status = useSelector((state: RootState) => (order ? state.order.statuses[order.id] ?? null : null));
  // The buyer's "it arrived" (orders/delivered.ts): null when there is none, undefined while not read.
  const delivered = useSelector((state: RootState) => (order ? state.order.delivered[order.id] : undefined));
  // The seller's view never names the coin from the buyer's own text (orders/useOrderCoin.ts).
  const coinView = useOrderCoinView(order, role);
  const sellerName = role === "seller" ? me?.name || order?.sellerName || "" : order?.sellerName || "";

  // The status, when the list hasn't read it (pinned read: ShowOrder.pin.test.tsx).
  useEffect(() => {
    if (open && order && sellerName) void ensureOrderStatus(store, order, sellerName);
  }, [open, order, sellerName, store]);
  useEffect(() => {
    if (open && order) void ensureDelivered(store, order);
  }, [open, order, store]);

  // The seller's draft starts from the status as read, and again whenever it is read anew. A status
  // that couldn't be read pre-selects nothing: "Received" there would put a real Shipped or Refunded
  // (and its note) back to Received with one tap, so the seller retries or chooses explicitly.
  const draftKey = status ? `${status.state}:${status.updated}` : "loading";
  const [draftState, setDraftState] = useState<{ key: string; orderId: string; draft: StatusDraft } | null>(null);
  const draft: StatusDraft =
    draftState && draftState.key === draftKey && draftState.orderId === order?.id
      ? draftState.draft
      : status?.state === "known"
        ? { status: normalizeStatus(status.status) ?? "Received", note: status.note, carrier: status.tracking?.carrier ?? "", trackingNumber: status.tracking?.number ?? "" }
        : { status: "", note: "", carrier: "", trackingNumber: "" };
  const setDraft = (next: StatusDraft) => setDraftState({ key: draftKey, orderId: order?.id ?? "", draft: next });
  const [retrying, setRetrying] = useState(false);

  // The seller sees the buyer's review of the shop, from the shop's shared review search.
  const sellerShopId = role === "seller" && order ? ((orderItems(order).find((i) => i.product?.storeId)?.product?.storeId as string | undefined) ?? "") : "";
  const shopReviews = useShopReviews(sellerShopId, sellerName || null);
  const buyerReview = sellerShopId && order ? (shopReviews.reviews.find((r) => sameName(r.name, order.user)) ?? null) : null;

  if (!order) return null;

  const items = orderItems(order);
  const deliveryFee = orderDelivery(order);
  const { coin, settings: coinSettings } = coinView;
  const digital = isDigitalOrder(order);
  const address = deliveryLines(order);
  const other = role === "seller" ? order.user : order.sellerName || "";
  const storeId = items.find((i) => i.product?.storeId)?.product?.storeId as string | undefined;
  const sending = !!status?.sending;
  const shown = shownStatus(status, delivered);
  const refunded = status?.state === "known" && normalizeStatus(status.status) === "Refunded";
  // The buyer's own order, shipped and not marked yet: it can be marked delivered.
  const mine = role === "buyer" && sameName(order.user, me?.name);
  const sellerStatus = status?.state === "known" ? normalizeStatus(status.status) : null;
  // A digital order has nothing to ship: it can be marked received as soon as it is placed.
  const canMarkDelivered = mine && delivered === null && (sellerStatus === "Shipped" || (digital && sellerStatus === "Received"));
  const markAsDelivered = async () => {
    const result = await markDelivered(store, order);
    if (result === "sent") dispatch(setNotification({ alertType: "success", msg: "Marked as delivered" }));
    else if (result === "timeout") {
      dispatch(setNotification({ alertType: "info", msg: "Hub didn't answer in time. If you accepted, it shows as delivered after a refresh." }));
    } else if (result === "failed") dispatch(setNotification({ alertType: "error", msg: "Couldn't mark it delivered. Try again." }));
  };

  const update = async () => {
    if (sending || !me?.name || !me.publicKey || normalizeStatus(draft.status) === null) return;
    const result = await sendOrderStatus(store, {
      order,
      seller: me.name,
      sellerPublicKey: me.publicKey,
      status: draft.status,
      note: draft.note,
      tracking: draft.trackingNumber.trim() ? { number: draft.trackingNumber.trim(), ...(draft.carrier.trim() && { carrier: draft.carrier.trim() }) } : null,
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

  // Reads the status document again from the node (the list's read, or the dialog's, failed).
  const retryStatus = async () => {
    if (retrying || !sellerName) return;
    setRetrying(true);
    try {
      await ensureOrderStatus(store, order, sellerName, true);
    } finally {
      setRetrying(false);
    }
  };

  const title = role === "seller" ? `Order from ${order.user}` : `Order at ${order.storeName || order.sellerName || "a shop"}`;
  const statusUnreadable = role === "seller" && status?.state === "error";
  const canUpdate =
    role === "seller" && !!status && !sending && normalizeStatus(draft.status) !== null && !sameDraft(draft, status);

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
          <OrderStatusChip status={shown} role={role} size="medium" />
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
          {delivered && !refunded && (
            <DeliveredNote
              who={mine ? null : order.user}
              at={delivered.at}
              sending={!!delivered.sending}
              digital={digital}
              reviewStoreId={mine && storeId && !delivered.sending ? storeId : undefined}
              shop={order.storeName || order.sellerName || "the shop"}
              storeTitle={order.storeName || ""}
            />
          )}
          {buyerReview && <BuyerReviewNote review={buyerReview} />}
          {canMarkDelivered && (
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, p: 1.5, borderRadius: 2, border: 1, borderColor: "divider" }}>
              <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{digital ? "Got it?" : "Has it arrived?"}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Let {order.sellerName || "the seller"} know, then review the shop. Hub asks you to confirm a small publish under your name.
                </Typography>
              </Box>
              <Button variant="contained" startIcon={<CheckCircleOutlinedIcon />} onClick={() => void markAsDelivered()} sx={{ minHeight: 44 }}>
                {digital ? "Mark as received" : "Mark as delivered"}
              </Button>
            </Box>
          )}
          {role === "seller" ? (
            status ? (
              <>
                {statusUnreadable && (
                  <Alert
                    severity="warning"
                    action={
                      <Button
                        color="inherit"
                        onClick={() => void retryStatus()}
                        aria-disabled={retrying || undefined}
                        sx={{ minHeight: 44, fontWeight: 700 }}
                      >
                        {retrying ? "Retrying…" : "Retry"}
                      </Button>
                    }
                  >
                    Couldn't read this order's current status. Retry, or choose a status below: updating replaces what
                    the buyer sees now.
                  </Alert>
                )}
                <StatusEditor draft={draft} onChange={setDraft} disabled={sending} />
              </>
            ) : (
              <Box role="status" aria-label="Loading the status">
                <Skeleton variant="rounded" height={44} />
                <Skeleton variant="rounded" height={72} sx={{ mt: 2 }} />
              </Box>
            )
          ) : status?.state === "known" && (status.note || status.tracking) ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {status.tracking && <TrackingBox tracking={status.tracking} />}
              {status.note && (
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography variant="body2" color="text.secondary">
                    Note from the seller
                  </Typography>
                  <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{status.note}</Typography>
                </Box>
              )}
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
              <ItemRow
                key={item.productId}
                item={item}
                coin={coin}
                coinSettings={coinSettings}
                sellerName={order.sellerName || ""}
              />
            ))}
            {deliveryFee && (
              // The shop's delivery fee for the address (delivery/model.ts): a line of the order, not a product.
              <Box component="li" sx={{ display: "flex", gap: 1.5, alignItems: "center", minWidth: 0 }}>
                <Box aria-hidden sx={{ width: 56, height: 56, borderRadius: 1.5, flexShrink: 0, bgcolor: "action.hover", display: "grid", placeItems: "center" }}>
                  <LocalShippingOutlinedIcon sx={{ color: "text.secondary" }} />
                </Box>
                <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflowWrap: "anywhere" }}>{deliveryFee.title}</Typography>
                <Box sx={{ flexShrink: 0, textAlign: "right" }}>
                  <AmountTag value={deliveryFee.total} coin={coin} shop={coinSettings} size="small" />
                </Box>
              </Box>
            )}
          </Box>
          <Divider />
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontWeight: 700 }}>Total</Typography>
            <AmountTag value={orderTotal(order)} coin={coin} shop={coinSettings} size="large" />
          </Box>
        </Section>

        <Section title="Payment">
          <PaymentDetails order={order} role={role} coin={coinView} />
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

/**
 * "Delivered": the buyer's own (with Write a review, or View review once
 * they have one for the shop, at once after publishing it), or the buyer's
 * for the seller to see. While it is being published, it says so.
 */
function DeliveredNote({
  who,
  at,
  sending,
  digital,
  shop,
  storeTitle,
  reviewStoreId,
}: {
  /** The buyer's name for the seller; null for the buyer themself. */
  who: string | null;
  at: number;
  sending: boolean;
  /** A digital order is received, not delivered. */
  digital: boolean;
  shop: string;
  /** The shop's own title, for the review dialog. */
  storeTitle?: string;
  /** The shop the buyer can review here; unset for the seller and while sending. */
  reviewStoreId?: string;
}) {
  const me = useSelector((state: RootState) => state.auth.user);
  const mine = useMyShopReview(reviewStoreId ?? "", reviewStoreId ? me?.name ?? "" : "");
  const [writing, setWriting] = useState(false);
  const [viewing, setViewing] = useState(false);
  const review = reviewStoreId ? mine.review : null;
  const date = at ? formatOrderDate(at) : "";
  const on = date ? `On ${date}. ` : "";
  return (
    <Box
      role="status"
      sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}
    >
      <CheckCircleOutlinedIcon color="success" aria-hidden />
      <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>
          {sending
            ? digital
              ? "Marking it received…"
              : "Marking it delivered…"
            : who
              ? digital
                ? `${who} says they received it`
                : `${who} says it arrived`
              : digital
                ? "You marked it received"
                : "You marked it delivered"}
        </Typography>
        {!sending && (
          <Typography variant="body2" color="text.secondary">
            {who ? on.trim() : review ? `${on}Your review of ${shop} is published.` : `${on}How was ${shop}? A review helps other buyers.`}
          </Typography>
        )}
      </Box>
      {reviewStoreId &&
        (review ? (
          <Button variant="outlined" color="inherit" startIcon={<RateReviewOutlinedIcon />} onClick={() => setViewing(true)} sx={{ minHeight: 44 }}>
            View review
          </Button>
        ) : mine.status === "loading" ? (
          <Skeleton variant="rounded" width={160} height={44} />
        ) : (
          <Button variant="contained" startIcon={<RateReviewOutlinedIcon />} onClick={() => setWriting(true)} sx={{ minHeight: 44 }}>
            Write a review
          </Button>
        ))}
      {reviewStoreId && review && viewing && (
        <ReviewDialog
          review={review}
          title={`Your review of ${shop}`}
          onClose={() => setViewing(false)}
          onWriteNew={() => {
            setViewing(false);
            setWriting(true);
          }}
        />
      )}
      {reviewStoreId && writing && (
        <AddReview open storeId={reviewStoreId} storeTitle={storeTitle ?? ""} onClose={() => setWriting(false)} />
      )}
    </Box>
  );
}

/** One review, opened from an order: the buyer's own (who can write a new one), or the buyer's for the seller. */
export function ReviewDialog({ review, title, onClose, onWriteNew }: { review: ShopReview; title: string; onClose: () => void; onWriteNew?: () => void }) {
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={title}
      actions={
        <>
          {onWriteNew && (
            <Button color="inherit" onClick={onWriteNew}>
              Write a new review
            </Button>
          )}
          <Button variant="contained" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <StoreReviewCard review={review} orderedHere />
      {onWriteNew && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          A new review replaces this one.
        </Typography>
      )}
    </ResponsiveDialog>
  );
}

/**
 * For the seller: the buyer's review of the shop (their latest, as the
 * Reviews tab counts it), with its stars and title, and View review.
 */
function BuyerReviewNote({ review }: { review: ShopReview }) {
  const [viewing, setViewing] = useState(false);
  const date = formatReviewDate(review.created);
  return (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
      <RateReviewOutlinedIcon color="primary" aria-hidden />
      <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{review.name} reviewed your shop</Typography>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1 }}>
          <Rating value={review.rating} precision={0.5} readOnly size="small" aria-label={`${review.rating} out of 5 stars`} />
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {[date, review.title ? `“${review.title}”` : ""].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
      </Box>
      <Button variant="outlined" color="inherit" startIcon={<RateReviewOutlinedIcon />} onClick={() => setViewing(true)} sx={{ minHeight: 44 }}>
        View review
      </Button>
      {viewing && <ReviewDialog review={review} title={`${review.name}'s review`} onClose={() => setViewing(false)} />}
    </Box>
  );
}
