import { useSelector } from "react-redux";
import { Box, Button, ButtonBase, CircularProgress, Rating, Skeleton, Typography } from "@mui/material";
import type { RootState } from "../../state/store";
import { visuallyHiddenSx } from "../../pages/Store/a11y";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import type { Order } from "../../state/features/orderSlice";
import { NameAvatar } from "../../components/common/NameAvatar";
import { AmountTag } from "../../components/money/PriceTag";
import type { OrderListItem } from "../selectors";
import { formatOrderDate, isDigitalOrder, itemCount, itemSummary, orderItems, orderTotal } from "../format";
import { useOrderCoinView } from "../useOrderCoin";
import { OrderStatusChip } from "./OrderStatusChip";
import { normalizeStatus } from "../status";
import { trackingLine } from "../tracking";
import { dispatchDue, policiesOf } from "../../shop/policies";
import { useNow } from "../../hooks/useNow";

export type OrderRole = "buyer" | "seller";

/** Who the card is about: the shop for the buyer, the buyer for the seller. */
export function counterpart(item: OrderListItem, role: OrderRole): { title: string; avatarName: string } {
  if (role === "seller") return { title: item.row.user, avatarName: item.row.user };
  const order = item.order;
  return { title: order?.storeName || order?.sellerName || "Shop", avatarName: order?.sellerName || "" };
}

const cardSx = {
  display: "flex",
  alignItems: "flex-start",
  gap: 1.5,
  width: "100%",
  minWidth: 0,
  p: { xs: 1.5, sm: 2 },
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "background.paper",
  textAlign: "left",
  boxSizing: "border-box",
} as const;

/**
 * A row of a seller's list whose order opened but names another seller: a
 * shop with the same id under another name. Not a button: it isn't this
 * seller's order to handle or to update.
 */
export function ForeignOrderCard({ item }: { item: OrderListItem }) {
  const date = formatOrderDate(item.row.created);
  return (
    <Box sx={cardSx}>
      <Box sx={{ flexShrink: 0 }}>
        <NameAvatar name={item.row.user} size={40} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{item.row.user}</Typography>
        <Typography variant="body2" color="text.secondary">
          This order names another seller, so it isn't yours to handle.{date && ` · ${date}`}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * One order in a list. Opened: the whole card is a button that opens the
 * order. Still opening: the card's shape with placeholders. Not on the node
 * yet: "Fetching from peers…". Failed: "Couldn't open this order" and Retry.
 */
export function OrderCard({
  item,
  role,
  onOpen,
  onRetry,
  review,
}: {
  item: OrderListItem;
  role: OrderRole;
  onOpen: (order: Order) => void;
  onRetry: (row: Order) => void;
  /** For the seller: the buyer's review of the shop, shown as its stars. */
  review?: { rating: number };
}) {
  const { row, order, openState, status } = item;
  // The seller's cards never name the coin from the buyer's own text (orders/useOrderCoin.ts).
  const coin = useOrderCoinView(order, role);
  const date = formatOrderDate(row.created);
  // The seller's own shop's policies (its dispatch time), for orders to handle.
  const ownShop = useSelector((state: RootState) => (role === "seller" ? state.global.currentStore : null));
  const policies = policiesOf(ownShop);
  // Whether one is late changes slowly: the time, kept every 10 minutes.
  const now = useNow(600_000);

  if (!order) {
    const failed = openState === "unavailable" || openState === "unreadable";
    return (
      <Box sx={cardSx} aria-busy={!failed || undefined}>
        <Box sx={{ width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {failed ? (
            <ErrorOutlineOutlinedIcon color="error" aria-hidden />
          ) : role === "seller" ? (
            <NameAvatar name={row.user} size={40} />
          ) : (
            <Skeleton variant="circular" width={40} height={40} aria-hidden />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {role === "seller" && <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{row.user}</Typography>}
          {failed ? (
            <>
              <Typography sx={{ fontWeight: 700 }}>Couldn't open this order</Typography>
              <Typography variant="body2" color="text.secondary">
                {openState === "unavailable" ? "It isn't on your node right now." : "It can't be decrypted or read."}
                {date && ` · ${date}`}
              </Typography>
              <Button variant="outlined" size="small" onClick={() => onRetry(row)} sx={{ mt: 1, minHeight: 44 }}>
                Retry
              </Button>
            </>
          ) : openState === "peers" ? (
            <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <CircularProgress size={16} aria-hidden />
              <Typography variant="body2" color="text.secondary">
                Fetching from peers…{date && ` · ${date}`}
              </Typography>
            </Box>
          ) : (
            <Box aria-label="Loading order" role="status">
              {role === "buyer" && <Skeleton width="55%" height={24} aria-hidden />}
              <Skeleton width="40%" aria-hidden />
              <Skeleton width="70%" aria-hidden />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  const items = orderItems(order);
  const digital = isDigitalOrder(order);
  // The seller's order still to handle, in a shop that states its dispatch time.
  const dispatchDays = role === "seller" && !digital && status?.state === "known" && normalizeStatus(status.status) === "Received" && !item.delivered ? policies?.dispatchDays : undefined;
  const dueDate = dispatchDays ? dispatchDue(row.created, dispatchDays) : null;
  const due = dueDate ? { late: now > dueDate.getTime(), text: dueDate.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) } : null;
  const who = counterpart(item, role);
  const count = itemCount(items);
  return (
    <ButtonBase
      onClick={() => onOpen(order)}
      focusRipple
      className="order-card"
      sx={{
        ...cardSx,
        transition: "background-color 150ms ease, border-color 150ms ease",
        "&:hover": { bgcolor: "action.hover" },
        "&.Mui-focusVisible": { outline: 2, outlineColor: "primary.main", outlineStyle: "solid", outlineOffset: 2 },
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      }}
    >
      <Box component="span" sx={{ flexShrink: 0 }}>
        <NameAvatar name={who.avatarName || who.title} size={40} />
      </Box>
      <Box component="span" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
        <Box component="span" sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
          <Typography component="span" sx={{ flex: 1, minWidth: 0, fontWeight: 700, lineHeight: 1.35, overflowWrap: "anywhere" }}>
            {who.title}
          </Typography>
          <Box component="span" sx={{ flexShrink: 0 }}>
            <OrderStatusChip status={status} role={role} />
          </Box>
        </Box>
        <Typography component="span" variant="body2" color="text.secondary">
          {date}
          {count > 0 && ` · ${count} ${count === 1 ? "item" : "items"}`}
        </Typography>
        <Typography
          component="span"
          variant="body2"
          sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", minWidth: 0 }}
        >
          {itemSummary(items)}
        </Typography>
        <Box component="span" sx={{ mt: 0.5, display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5 }}>
          <AmountTag value={orderTotal(order)} coin={coin.coin} shop={coin.settings} size="small" />
          {review && (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
              <Rating value={review.rating} precision={0.5} readOnly size="small" aria-hidden />
              <Typography component="span" variant="body2" color="text.secondary">
                Reviewed<Box component="span" sx={visuallyHiddenSx}>{` ${review.rating} out of 5 stars`}</Box>
              </Typography>
            </Box>
          )}
        </Box>
        {/* To handle: when it's due to leave, by the shop's dispatch time (shop/policies.ts). */}
        {due && (
          <Typography component="span" variant="body2" sx={{ fontWeight: 600, color: due.late ? "error.main" : "text.secondary" }}>
            {due.late ? `Dispatch was due ${due.text}` : `Dispatch by ${due.text}`}
          </Typography>
        )}
        {/* The seller's carrier and tracking number (orders/tracking.ts), at a glance; the order copies it. */}
        {status?.state === "known" && status.tracking && normalizeStatus(status.status) === "Shipped" && (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {trackingLine(status.tracking)}
          </Typography>
        )}
        {/* Shipped (a digital order: placed) and not marked yet: the order's dialog has Mark as delivered (orders/delivered.ts). */}
        {role === "buyer" && item.delivered === null && status?.state === "known" && (normalizeStatus(status.status) === "Shipped" || (digital && normalizeStatus(status.status) === "Received")) && (
          <Typography component="span" variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: "primary.main" }}>
            {digital ? "Got it? Open it to mark it received." : "Arrived? Open it to mark it delivered."}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}
