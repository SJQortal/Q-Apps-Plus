import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Box, Button, Link, Skeleton, Typography } from "@mui/material";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { EmptyState } from "../../components/common/EmptyState";
import type { Order } from "../../state/features/orderSlice";
import type { OrderList } from "../hooks";
import type { OrderListItem } from "../selectors";
import { foreignAppCounts, sellerStatusCounts, splitForeignItems, splitSellerItems, visibleItems } from "../listView";
import { useOpenQortalLink } from "../../richtext/QortalText";
import { countStatuses, type StatusCounts, type StatusFilter } from "../status";
import { ForeignOrderCard, OrderCard, type OrderRole } from "./OrderCard";
import { StatusFilterBar } from "./StatusFilterBar";
import { LoadMore } from "./LoadMore";

function noneText(filter: StatusFilter, role: OrderRole): string {
  if (filter === "Received") return role === "seller" ? "Nothing to handle" : "No orders waiting to ship";
  if (filter === "Shipped") return "No shipped orders";
  if (filter === "Delivered") return "No delivered orders";
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
 * The rows of a seller's list that aren't counted as theirs: orders that
 * couldn't be opened (with Retry), and orders that name another seller (a
 * shop with the same id under another name). Folded by default.
 */
export function UncountedOrders({ items, onRetry }: { items: OrderListItem[]; onRetry: (row: Order) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <Box
      component="section"
      aria-labelledby={`${id}-title`}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        p: { xs: 1.5, sm: 2 },
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography id={`${id}-title`} component="h3" sx={{ fontWeight: 700 }}>
            Orders not counted ({items.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            They use your shop's id but couldn't be opened, or they name another seller. They aren't in your counts.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          sx={{ minHeight: 44 }}
        >
          {open ? "Hide" : "Show"}
        </Button>
      </Box>
      {open && (
        <Box
          component="ul"
          id={`${id}-list`}
          aria-label="Orders not counted"
          sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
        >
          {items.map((item) => (
            <Box component="li" key={item.row.id} sx={{ minWidth: 0 }}>
              {item.order ? (
                <ForeignOrderCard item={item} />
              ) : (
                <OrderCard item={item} role="seller" onOpen={() => {}} onRetry={onRetry} />
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * Another app's orders under Q-Shop's prefix, counted under the list instead
 * of shown as orders that can't be opened (Simon's Hub, 2026-10-27: eight
 * Q-Shops orders, each "Couldn't open this order" with a Retry that couldn't
 * help): "8 orders placed in Q-Shops aren't listed here. Open Q-Shops".
 */
function ForeignOrdersNote({ items }: { items: OrderListItem[] }) {
  const openLink = useOpenQortalLink();
  const apps = useMemo(() => foreignAppCounts(items), [items]);
  if (apps.length === 0) return null;
  return (
    <Box role="note" sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {apps.map((app) => (
        <Typography key={app.name} variant="body2" color="text.secondary">
          {`${app.count === 1 ? "1 order" : `${app.count} orders`} placed in ${app.name} ${app.count === 1 ? "isn't" : "aren't"} listed here.`}
          {app.link && (
            <>
              {" "}
              <Link href={app.link} onClick={(event) => openLink(event, app.link as string)} className="qortal-link" underline="always">
                Open {app.name}
              </Link>
            </>
          )}
        </Typography>
      ))}
    </Box>
  );
}

function buyerCounts(items: OrderListItem[]): { counts: StatusCounts; loading: boolean } {
  const counts = countStatuses(
    items.map((i) => i.row.id),
    Object.fromEntries(items.map((i) => [i.row.id, i.status ?? undefined]))
  );
  // An order that can't be opened never gets a status on the buyer's side: don't wait for it.
  const loading = items.some((i) => !i.status && i.openState !== "unreadable" && i.openState !== "unavailable");
  return { counts, loading };
}

const NO_ROWS: OrderListItem[] = [];

/**
 * An order list with its filters and every state: first-page placeholders,
 * a first-page error with Retry, the empty list (`empty`), "nothing matches"
 * for a filter or a search, the cards, and the next pages. A seller's rows
 * that aren't theirs to count (couldn't be opened, or name another seller)
 * are kept out of the counts, the filters and "To handle", and shown apart.
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
  reviewOf,
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
  /** The seller's list: a buyer's review of the shop, by name (its stars show on their orders). */
  reviewOf?: (name: string) => { rating: number } | undefined;
}) {
  const { items, meta } = list;
  const seller = role === "seller" ? list.seller : "";
  // Another app's orders (Q-Shops) are only counted under the list.
  const { rest, foreign } = useMemo(() => splitForeignItems(items), [items]);
  const { main, others } = useMemo(
    () => (role === "seller" ? splitSellerItems(rest, seller) : { main: rest, others: NO_ROWS }),
    [rest, role, seller]
  );
  const { counts, loading: statusesLoading } = useMemo(
    () => (role === "seller" ? sellerStatusCounts(main, seller) : buyerCounts(main)),
    [main, role, seller]
  );
  const shown = useMemo(
    () => visibleItems(main, { filter, search, role, seller: role === "seller" ? seller : undefined }),
    [main, filter, search, role, seller]
  );
  // A seller's rows are opened when a view shows them (the Overview opens only its latest few).
  const { open } = list;
  useEffect(() => {
    if (role === "seller") open(shown.map((item) => item.row));
  }, [role, open, shown]);

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

  const more = meta.hasMore;
  const filtered = filter !== "all" || search.trim() !== "";
  let content: ReactNode;
  if (main.length === 0) {
    // Nothing of this shop's in the pages read so far (another shop's orders, or rows not counted): look further.
    content = more ? (
      <Typography role="status" variant="body2" color="text.secondary" sx={{ textAlign: "center", pt: 2 }}>
        No orders found in the first {meta.offset} results.
      </Typography>
    ) : (
      empty
    );
  } else {
    content = (
      <>
        <StatusFilterBar
          value={filter}
          onChange={onFilterChange}
          counts={counts}
          total={main.length}
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
                <OrderCard item={item} role={role} onOpen={onOpen} onRetry={(row) => void list.retry(row)} review={reviewOf?.(item.row.user)} />
              </Box>
            ))}
          </Box>
        )}
      </>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {content}
      {others.length > 0 && <UncountedOrders items={others} onRetry={(row) => void list.retry(row)} />}
      <ForeignOrdersNote items={foreign} />
      <LoadMore hasMore={more} loading={meta.loadingMore} failed={meta.moreError} onLoadMore={list.loadMore} />
    </Box>
  );
}
