/**
 * The seller's overview of a shop (the seller page's first tab): tiles for
 * the orders to handle, shipped and refunded (counted over the orders loaded
 * so far, "+" while more pages exist), the products in the shop, the five
 * latest orders, and links to the other tabs.
 */
import { useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Box, Button, ButtonBase, Skeleton, Typography } from "@mui/material";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ChevronRightOutlinedIcon from "@mui/icons-material/ChevronRightOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import type { RootState } from "../../state/store";
import type { Order } from "../../state/features/orderSlice";
import { EmptyState } from "../../components/common/EmptyState";
import { useShopOrders } from "../../orders/hooks";
import { countLabel, countStatuses } from "../../orders/status";
import { OrderCard } from "../../orders/components/OrderCard";
import { OrderListSkeleton } from "../../orders/components/OrderListView";
import { ShowOrder } from "./ShowOrder/ShowOrder";

export type SellerTab = "products" | "orders" | "reviews" | "shop";

const LATEST = 5;

function Tile({
  label,
  value,
  icon,
  tone,
  loading,
  onClick,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "warning" | "success" | "error" | "primary";
  loading: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Box component="span" aria-hidden sx={{ color: `${tone}.main`, display: "flex", "& svg": { fontSize: 22 } }}>
        {icon}
      </Box>
      <Box component="span" sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Typography component="span" sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
          {loading ? <Skeleton width={40} /> : value}
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </>
  );
  const sx = {
    display: "flex",
    alignItems: "flex-start",
    gap: 1.5,
    p: 2,
    minHeight: 88,
    width: "100%",
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
    textAlign: "left",
    justifyContent: "flex-start",
    boxSizing: "border-box",
  } as const;
  if (!onClick) return <Box sx={sx}>{content}</Box>;
  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        ...sx,
        transition: "background-color 150ms ease",
        "&:hover": { bgcolor: "action.hover" },
        "&.Mui-focusVisible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      {content}
    </ButtonBase>
  );
}

export function SellerOverview({ storeId, onOpenTab }: { storeId: string; onOpenTab?: (tab: SellerTab) => void }) {
  const list = useShopOrders(storeId);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const ids = list.items.map((i) => i.row.id);
  const counts = countStatuses(ids, Object.fromEntries(list.items.map((i) => [i.row.id, i.status ?? undefined])));
  const more = list.meta.hasMore;
  const ordersLoading = list.meta.phase === "loading" || list.meta.phase === "idle";
  const statusesLoading = list.items.some((i) => !i.status);
  const productCount =
    dataContainer && dataContainer.storeId === storeId ? Object.keys(dataContainer.products ?? {}).length : null;
  const latest = list.items.slice(0, LATEST);
  const opened: Order | null = list.items.find((i) => i.row.id === openId)?.order ?? null;
  const openOrders = onOpenTab ? () => onOpenTab("orders") : undefined;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box component="section" aria-labelledby="seller-overview-numbers">
        <Typography id="seller-overview-numbers" component="h2" sx={{ fontSize: 18, fontWeight: 700, mb: 1.5 }}>
          At a glance
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
          <Tile
            label="To handle"
            value={countLabel(counts.Received, more)}
            icon={<HourglassEmptyOutlinedIcon />}
            tone="warning"
            loading={ordersLoading || statusesLoading}
            onClick={openOrders}
          />
          <Tile
            label="Shipped"
            value={countLabel(counts.Shipped, more)}
            icon={<LocalShippingOutlinedIcon />}
            tone="success"
            loading={ordersLoading || statusesLoading}
            onClick={openOrders}
          />
          <Tile
            label="Refunded"
            value={countLabel(counts.Refunded, more)}
            icon={<ReplayOutlinedIcon />}
            tone="error"
            loading={ordersLoading || statusesLoading}
            onClick={openOrders}
          />
          <Tile
            label="Products"
            value={productCount === null ? "—" : String(productCount)}
            icon={<Inventory2OutlinedIcon />}
            tone="primary"
            loading={false}
            onClick={onOpenTab ? () => onOpenTab("products") : undefined}
          />
        </Box>
        {more && !ordersLoading && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Counted over your {list.items.length} latest orders.
          </Typography>
        )}
      </Box>

      <Box component="section" aria-labelledby="seller-overview-latest">
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Typography id="seller-overview-latest" component="h2" sx={{ flex: 1, fontSize: 18, fontWeight: 700 }}>
            Latest orders
          </Typography>
          {onOpenTab && list.items.length > 0 && (
            <Button onClick={() => onOpenTab("orders")} endIcon={<ChevronRightOutlinedIcon />} sx={{ minHeight: 44 }}>
              All orders
            </Button>
          )}
        </Box>
        {list.meta.phase === "error" && list.items.length === 0 ? (
          <EmptyState
            title="Couldn't load your shop's orders"
            description="The node didn't answer. Try again in a moment."
            actionLabel="Retry"
            onAction={() => void list.refresh()}
          />
        ) : ordersLoading && list.items.length === 0 ? (
          <OrderListSkeleton rows={3} />
        ) : latest.length === 0 && more ? (
          <EmptyState
            icon={<ReceiptLongOutlinedIcon />}
            title="No orders found yet"
            description={`The first ${list.meta.offset} results were orders of other shops whose id starts like yours. Open Orders to look further.`}
            actionLabel={onOpenTab ? "Open orders" : undefined}
            onAction={onOpenTab ? () => onOpenTab("orders") : undefined}
          />
        ) : latest.length === 0 ? (
          <EmptyState
            icon={<ReceiptLongOutlinedIcon />}
            title="No orders yet"
            description="When someone buys from your shop, the order shows here and you get a Q-Mail."
          />
        ) : (
          <Box
            component="ul"
            aria-label="Latest orders"
            sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
          >
            {latest.map((item) => (
              <Box component="li" key={item.row.id}>
                <OrderCard
                  item={item}
                  role="seller"
                  onOpen={(order) => {
                    setOpenId(order.id);
                    setDialogOpen(true);
                  }}
                  onRetry={(row) => void list.retry(row)}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {onOpenTab && (
        <Box component="nav" aria-label="Manage your shop" sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button variant="outlined" onClick={() => onOpenTab("products")} sx={{ minHeight: 44 }}>
            Products
          </Button>
          <Button variant="outlined" onClick={() => onOpenTab("orders")} sx={{ minHeight: 44 }}>
            Orders
          </Button>
          <Button variant="outlined" onClick={() => onOpenTab("reviews")} sx={{ minHeight: 44 }}>
            Reviews
          </Button>
          <Button variant="outlined" onClick={() => onOpenTab("shop")} sx={{ minHeight: 44 }}>
            Shop details
          </Button>
        </Box>
      )}

      <ShowOrder open={dialogOpen && !!opened} onClose={() => setDialogOpen(false)} order={opened} role="seller" />
    </Box>
  );
}

export default SellerOverview;
