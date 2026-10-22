import { Box, Button, ButtonBase, CircularProgress, Skeleton, Typography } from "@mui/material";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import type { Order } from "../../state/features/orderSlice";
import { NameAvatar } from "../../components/common/NameAvatar";
import { AmountTag } from "../../components/money/PriceTag";
import type { OrderListItem } from "../selectors";
import { formatOrderDate, itemCount, itemSummary, orderCoin, orderCoinSettings, orderItems, orderTotal } from "../format";
import { OrderStatusChip } from "./OrderStatusChip";

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
 * One order in a list. Opened: the whole card is a button that opens the
 * order. Still opening: the card's shape with placeholders. Not on the node
 * yet: "Fetching from peers…". Failed: "Couldn't open this order" and Retry.
 */
export function OrderCard({
  item,
  role,
  onOpen,
  onRetry,
}: {
  item: OrderListItem;
  role: OrderRole;
  onOpen: (order: Order) => void;
  onRetry: (row: Order) => void;
}) {
  const { row, order, openState, status } = item;
  const date = formatOrderDate(row.created);

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
        <Box component="span" sx={{ mt: 0.5 }}>
          <AmountTag value={orderTotal(order)} coin={orderCoin(order)} shop={orderCoinSettings(order)} size="small" />
        </Box>
      </Box>
    </ButtonBase>
  );
}
