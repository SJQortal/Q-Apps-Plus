/**
 * My orders (/my-orders): the orders the signed-in name placed, newest
 * first, a page of 20 at a time, each with its shop, date, items, total and
 * status; filters by status with counts; the order in a dialog. Paid orders
 * that still need recording (money/pendingOrders.ts) get a banner that
 * leads to the cart, where they are finished without paying again.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, IconButton, Tooltip } from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import { Page, PageHeader } from "../../components/layout/Page";
import { EmptyState } from "../../components/common/EmptyState";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import type { Order } from "../../state/features/orderSlice";
import { useBuyerOrders, usePendingOrderCount, useSignIn } from "../../orders/hooks";
import { OrderListView } from "../../orders/components/OrderListView";
import type { StatusFilter } from "../../orders/status";
import { ShowOrder } from "../ProductManager/ShowOrder/ShowOrder";

export const MyOrders = () => {
  const navigate = useNavigate();
  const list = useBuyerOrders();
  const pending = usePendingOrderCount(list.name);
  const { signIn, signingIn } = useSignIn();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  // The order stays while the dialog slides away.
  const [dialogOpen, setDialogOpen] = useState(false);
  const opened: Order | null = list.items.find((i) => i.row.id === openId)?.order ?? null;
  const { pull, refreshing } = usePullToRefresh(list.refresh, !!list.name);

  if (!list.name) {
    return (
      <Page width="list">
        <PageHeader title="My orders" />
        <EmptyState
          icon={<AccountCircleOutlinedIcon />}
          title="Sign in to see your orders"
          description="Your orders are encrypted: only your Qortal name can open them."
          actionLabel={signingIn ? "Signing in…" : "Sign in"}
          onAction={signIn}
        />
      </Page>
    );
  }

  const busy = refreshing || list.meta.refreshing;
  return (
    <Page width="list">
      {(pull > 0 || busy) && (
        <Box
          role="status"
          aria-label="Refreshing"
          sx={{ display: "flex", justifyContent: "center", height: Math.max(pull, busy ? 40 : 0), alignItems: "center" }}
        >
          <CircularProgress size={22} variant={busy ? "indeterminate" : "determinate"} value={Math.min(100, (pull / 72) * 100)} />
        </Box>
      )}
      <PageHeader
        title="My orders"
        subtitle="Orders you placed, newest first"
        actions={
          <Tooltip title="Refresh">
            <span>
              <IconButton aria-label="Refresh" onClick={() => void list.refresh()} disabled={busy} sx={{ width: 44, height: 44 }}>
                <RefreshOutlinedIcon />
              </IconButton>
            </span>
          </Tooltip>
        }
      />
      {pending > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2, alignItems: "center" }}
          action={
            <Button color="inherit" onClick={() => navigate("/cart")} sx={{ minHeight: 44, fontWeight: 700 }}>
              Finish
            </Button>
          }
        >
          {pending === 1
            ? "You paid for an order that isn't recorded yet. Finish it from the cart, without paying again."
            : `You paid for ${pending} orders that aren't recorded yet. Finish them from the cart, without paying again.`}
        </Alert>
      )}
      <OrderListView
        role="buyer"
        list={list}
        filter={filter}
        onFilterChange={setFilter}
        onOpen={(order) => {
          setOpenId(order.id);
          setDialogOpen(true);
        }}
        errorText="Couldn't load your orders"
        empty={
          <EmptyState
            icon={<ReceiptLongOutlinedIcon />}
            title="No orders yet"
            description="Orders you place in any shop show here, with their status."
            actionLabel="Browse shops"
            onAction={() => navigate("/")}
          />
        }
      />
      <ShowOrder open={dialogOpen && !!opened} onClose={() => setDialogOpen(false)} order={opened} role="buyer" />
    </Page>
  );
};

export default MyOrders;
