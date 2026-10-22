/**
 * The seller's received orders for their current shop (the seller page's
 * Orders tab): the orders to handle first, filters by status with counts, a
 * search by buyer over the loaded orders, and the order in a dialog where
 * the seller updates its status.
 */
import { useState } from "react";
import { useSelector } from "react-redux";
import { Box, CircularProgress, IconButton, InputAdornment, TextField, Tooltip, Typography } from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { EmptyState } from "../../components/common/EmptyState";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import type { RootState } from "../../state/store";
import type { Order } from "../../state/features/orderSlice";
import { useShopOrders } from "../../orders/hooks";
import { OrderListSkeleton, OrderListView } from "../../orders/components/OrderListView";
import type { StatusFilter } from "../../orders/status";
import { ShowOrder } from "./ShowOrder/ShowOrder";

export function OrdersTab() {
  const list = useShopOrders();
  const ownShopStatus = useSelector((state: RootState) => state.global.ownShopStatus);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const opened: Order | null = list.items.find((i) => i.row.id === openId)?.order ?? null;
  const { pull, refreshing } = usePullToRefresh(list.refresh, !!list.shop);
  const busy = refreshing || list.meta.refreshing;

  if (!list.shop) {
    if (ownShopStatus === "idle" || ownShopStatus === "loading") return <OrderListSkeleton rows={3} />;
    return (
      <EmptyState
        icon={<ReceiptLongOutlinedIcon />}
        title="No shop selected"
        description="Orders show here once your shop has loaded."
      />
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {(pull > 0 || busy) && (
        <Box
          role="status"
          aria-label="Refreshing"
          sx={{ display: "flex", justifyContent: "center", height: Math.max(pull, busy ? 40 : 0), alignItems: "center" }}
        >
          <CircularProgress size={22} variant={busy ? "indeterminate" : "determinate"} value={Math.min(100, (pull / 72) * 100)} />
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography component="h2" sx={{ flex: 1, fontSize: 18, fontWeight: 700 }}>
          Orders
        </Typography>
        <Tooltip title="Refresh">
          <span>
            <IconButton
              aria-label="Refresh orders"
              onClick={() => void list.refresh()}
              disabled={busy}
              sx={{ width: 44, height: 44 }}
            >
              <RefreshOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      {list.items.length > 0 && (
        <TextField
          type="search"
          label="Search by buyer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon aria-hidden />
                </InputAdornment>
              ),
            },
            htmlInput: { enterKeyHint: "search", autoComplete: "off" },
          }}
        />
      )}
      <OrderListView
        role="seller"
        list={list}
        filter={filter}
        onFilterChange={setFilter}
        search={search}
        onClearSearch={() => setSearch("")}
        onOpen={(order) => {
          setOpenId(order.id);
          setDialogOpen(true);
        }}
        errorText="Couldn't load your shop's orders"
        empty={
          <EmptyState
            icon={<ReceiptLongOutlinedIcon />}
            title="No orders yet"
            description="When someone buys from your shop, the order shows here and you get a Q-Mail."
          />
        }
      />
      <ShowOrder open={dialogOpen && !!opened} onClose={() => setDialogOpen(false)} order={opened} role="seller" />
    </Box>
  );
}

export default OrdersTab;
