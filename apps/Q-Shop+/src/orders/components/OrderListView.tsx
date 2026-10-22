import { useMemo, type ReactNode } from "react";
import { Box, Button, Skeleton, Typography } from "@mui/material";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { EmptyState } from "../../components/common/EmptyState";
import type { Order } from "../../state/features/orderSlice";
import type { OrderList } from "../hooks";
import { visibleItems } from "../listView";
import { countStatuses, type StatusFilter } from "../status";
import { OrderCard, type OrderRole } from "./OrderCard";
import { StatusFilterBar } from "./StatusFilterBar";
import { LoadMore } from "./LoadMore";

function noneText(filter: StatusFilter, role: OrderRole): string {
  if (filter === "Received") return role === "seller" ? "Nothing to handle" : "No orders waiting to ship";
  if (filter === "Shipped") return "No shipped orders";
  if (filter === "Refunded") return "No refunded orders";
  return "No orders";
}

/** Placeholders shaped like order cards, for the first page. */
export function OrderListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Box role="status" aria-label="Loading orders" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Box
          key={i}
          aria-hidden
          sx={{
            display: "flex",
            gap: 1.5,
            p: { xs: 1.5, sm: 2 },
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
          }}
        >
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
              <Skeleton width="45%" height={24} />
              <Skeleton variant="rounded" width={88} height={24} />
            </Box>
            <Skeleton width="35%" />
            <Skeleton width="65%" />
            <Skeleton width="25%" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * An order list with its filters and every state: first-page placeholders,
 * a first-page error with Retry, the empty list (`empty`), "nothing matches"
 * for a filter or a search, the cards, and the next pages.
 */
export function OrderListView({
  role,
  list,
  filter,
  onFilterChange,
  search = "",
  onClearSearch,
  onOpen,
  empty,
  errorText,
}: {
  role: OrderRole;
  list: OrderList;
  filter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  search?: string;
  onClearSearch?: () => void;
  onOpen: (order: Order) => void;
  /** The empty state when there are no orders at all. */
  empty: ReactNode;
  errorText: string;
}) {
  const { items, meta } = list;
  const counts = useMemo(
    () =>
      countStatuses(
        items.map((i) => i.row.id),
        Object.fromEntries(items.map((i) => [i.row.id, i.status ?? undefined]))
      ),
    [items]
  );
  const shown = useMemo(() => visibleItems(items, { filter, search, role }), [items, filter, search, role]);
  // An order that can't be opened never gets a status on the buyer's side: don't wait for it.
  const statusesLoading = items.some((i) => !i.status && i.openState !== "unreadable" && i.openState !== "unavailable");

  if (meta.phase === "error" && items.length === 0) {
    return (
      <EmptyState
        icon={<ErrorOutlineOutlinedIcon />}
        title={errorText}
        description="The node didn't answer. Try again in a moment."
        actionLabel="Retry"
        onAction={() => void list.refresh()}
      />
    );
  }
  if ((meta.phase === "loading" || meta.phase === "idle") && items.length === 0) return <OrderListSkeleton />;
  if (items.length === 0 && !meta.hasMore) return <>{empty}</>;
  if (items.length === 0) {
    // The pages read so far held only other shops' orders (a longer id with the same start): look further.
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography role="status" variant="body2" color="text.secondary" sx={{ textAlign: "center", pt: 2 }}>
          No orders found in the first {meta.offset} results.
        </Typography>
        <LoadMore hasMore loading={meta.loadingMore} failed={meta.moreError} onLoadMore={list.loadMore} />
      </Box>
    );
  }

  const more = meta.hasMore;
  const filtered = filter !== "all" || search.trim() !== "";
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <StatusFilterBar
        value={filter}
        onChange={onFilterChange}
        counts={counts}
        total={items.length}
        more={more}
        role={role}
        statusesLoading={statusesLoading}
      />
      {shown.length === 0 ? (
        <Box
          role="status"
          sx={{ py: 4, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
        >
          <Typography sx={{ fontWeight: 700 }}>
            {search.trim()
              ? `No orders from “${search.trim()}”${more ? " in the orders loaded so far" : ""}`
              : `${noneText(filter, role)}${more ? " in the orders loaded so far" : ""}`}
          </Typography>
          {filtered && (
            <Button
              variant="outlined"
              sx={{ minHeight: 44 }}
              onClick={() => {
                if (search.trim() && onClearSearch) onClearSearch();
                else onFilterChange("all");
              }}
            >
              {search.trim() && onClearSearch ? "Clear search" : "Show all orders"}
            </Button>
          )}
        </Box>
      ) : (
        <Box
          component="ul"
          aria-label={role === "seller" ? "Orders received" : "Your orders"}
          sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          {shown.map((item) => (
            <Box component="li" key={item.row.id} sx={{ minWidth: 0 }}>
              <OrderCard item={item} role={role} onOpen={onOpen} onRetry={(row) => void list.retry(row)} />
            </Box>
          ))}
        </Box>
      )}
      <LoadMore hasMore={more} loading={meta.loadingMore} failed={meta.moreError} onLoadMore={list.loadMore} />
    </Box>
  );
}
