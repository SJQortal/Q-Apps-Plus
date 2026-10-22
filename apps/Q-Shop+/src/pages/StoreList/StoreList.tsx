/**
 * The home page: the marketplace's front door (docs/apps/Q-Shop+.md →
 * Missing features 1–2, UX problems 5). A search over every shop, sorts and
 * filters, and a grid of shop cards that paints from one search, with each
 * shop's logo read only when its card nears the screen. The search text,
 * sort and filters live in the URL (`?q=&sort=&pay=&mine=1`), so Back from a
 * shop comes back to the same list.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Box, Button, CircularProgress, LinearProgress, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { RootState } from "../../state/store";
import { resetListProducts, resetProducts, toggleCreateStoreModal } from "../../state/features/globalSlice";
import { clearViewedStoreDataContainer } from "../../state/features/storeSlice";
import { Page, PageHeader } from "../../components/layout/Page";
import { EmptyState } from "../../components/common/EmptyState";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { APP_NAME } from "../../constants/plus";
import { accentWash } from "../../hub-theme";
import { storePath } from "../../qdn/links";
import { StoreCard } from "../Store/StoreCard/StoreCard";
import { ShopGridList, ShopGridSkeleton } from "../../discovery/ShopGrid";
import { ShopMenu, type ShopMenuTarget } from "../../discovery/ShopMenu";
import { LoadMoreSentinel } from "../../discovery/LoadMoreSentinel";
import { NewProductsStrip } from "../../discovery/NewProductsStrip";
import { ShopSearchField, SortFilterRow, SortFilterSheet, type SortFilterProps } from "../../discovery/HomeControls";
import { HOME_PAGE_SIZE, useHomeShops, type HomeShops } from "../../discovery/useHomeShops";
import { SHOP_INDEX_LIMIT, shopKey, type ShopEntry } from "../../discovery/shopIndex";
import { parsePay, parseSort, payLabel, payNeedsDetails, SHOP_SORTS, type PayFilter, type ShopSort } from "../../discovery/sortFilter";

/** Shop cards before the new-products strip: two rows on a wide screen. */
const STRIP_AFTER = 8;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The count line beside the sort and filters. */
function statusText(home: HomeShops, q: string): string {
  if (home.phase === "loading") return "Loading shops…";
  if (home.phase === "error") return "";
  if (home.searching) return "Searching…";
  if (home.checked && home.checked.done < home.checked.of) {
    return `${home.total} found · checked ${home.checked.done} of ${home.checked.of}`;
  }
  const more = home.searchHasMore ? "+" : "";
  if (q) return `${home.total}${more} ${home.total === 1 && !more ? "shop matches" : "shops match"}`;
  return plural(home.total, "shop", "shops");
}

function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  return (
    <Box
      role="status"
      aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
      sx={{
        height: refreshing ? 48 : Math.round(pull * 0.6),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <CircularProgress
        size={24}
        variant={refreshing ? "indeterminate" : "determinate"}
        value={Math.min(100, (pull / 72) * 100)}
      />
    </Box>
  );
}

export const StoreList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const store = useStore<RootState>();
  const phone = usePhoneLayout();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const sort = parseSort(params.get("sort"));
  const pay = parsePay(params.get("pay"));
  const userName = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const myStores = useSelector((state: RootState) => state.store.myStores);
  const ownShopStatus = useSelector((state: RootState) => state.global.ownShopStatus);
  // "My shops" only means something while signed in.
  const mine = params.get("mine") === "1" && Boolean(userName);
  const mineKeys = useMemo(
    () => (mine ? new Set(myStores.map((shop) => shopKey(shop.owner, shop.id))) : null),
    [mine, myStores]
  );
  const query = useMemo(() => ({ q, sort, pay, mine }), [q, sort, pay, mine]);
  const home = useHomeShops(query, mineKeys);
  const { remember, restoreScrollY, phase } = home;
  const [menu, setMenu] = useState<ShopMenuTarget | null>(null);

  // Filters change the URL in place, so Back leaves the page rather than stepping through them.
  const updateParams = useCallback(
    (patch: Record<string, string>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  const onSearch = useCallback((text: string) => updateParams({ q: text }), [updateParams]);
  const onSort = useCallback((next: ShopSort) => updateParams({ sort: next === "newest" ? "" : next }), [updateParams]);
  const onPay = useCallback((next: PayFilter) => updateParams({ pay: next }), [updateParams]);
  const onMine = useCallback((next: boolean) => updateParams({ mine: next ? "1" : "" }), [updateParams]);
  const resetFilters = useCallback(() => updateParams({ sort: "", pay: "", mine: "" }), [updateParams]);
  const openCreateShop = useCallback(() => dispatch(toggleCreateStoreModal(true)), [dispatch]);

  // Leaving for a shop: clear the last shop's products if it was another one
  // (the original card did this), and remember where the list was.
  const prepareOpen = useCallback(
    (shop: ShopEntry) => {
      remember();
      const state = store.getState();
      const me = state.auth.user?.name;
      if (me === shop.owner && state.global.currentStore?.id !== shop.id) {
        dispatch(resetProducts());
        dispatch(resetListProducts());
      } else if (me !== shop.owner && state.store.currentViewedStore?.id !== shop.id) {
        dispatch(resetProducts());
        dispatch(clearViewedStoreDataContainer());
      }
    },
    [remember, store, dispatch]
  );
  const openShop = useCallback(
    (shop: ShopEntry) => {
      prepareOpen(shop);
      navigate(storePath(shop.owner, shop.id));
    },
    [prepareOpen, navigate]
  );
  const onMenu = useCallback((shop: ShopEntry, anchor: HTMLElement) => setMenu({ shop, anchor }), []);

  // New products show only from shops in the index, under the name that published them.
  const listed = useMemo(() => new Set(home.indexShops.map((shop) => shop.key)), [home.indexShops]);
  const isListedShop = useCallback((owner: string, storeId: string) => listed.has(shopKey(owner, storeId)), [listed]);

  const { pull, refreshing } = usePullToRefresh(home.refresh, phone);

  // Back from a shop: once the list is there again, scroll to where it was.
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current || phase !== "ready" || restoreScrollY <= 0) return;
    restored.current = true;
    try {
      window.scrollTo(0, restoreScrollY);
    } catch {
      // not every environment can scroll
    }
  }, [phase, restoreScrollY]);

  const canFilterMine = Boolean(userName) && myStores.length > 0;
  const controls: SortFilterProps = {
    sort,
    pay,
    mine,
    canFilterMine,
    onSort,
    onPay,
    onMine,
    onReset: resetFilters,
    status: statusText(home, q),
  };
  const filtersOn = Boolean(pay || mine);
  const noShop = Boolean(userName) && ownShopStatus === "none";

  const empty: ComponentProps<typeof EmptyState> =
    mine && myStores.length === 0
      ? {
          icon: <StorefrontOutlinedIcon />,
          title: "You don't have a shop yet",
          description: "Open one to start selling.",
          actionLabel: "Open your own shop",
          onAction: openCreateShop,
        }
      : filtersOn
        ? {
            title: "No shops match these filters",
            description: pay
              ? `None of ${mine ? "your shops" : q ? "the shops found" : "the shops listed"} take ${payLabel(pay)}.`
              : q
                ? "None of your shops match this search."
                : "None of your shops match.",
            actionLabel: "Reset filters",
            onAction: resetFilters,
          }
        : q
          ? {
              icon: <SearchOffIcon />,
              title: `No shops match "${q}"`,
              description: "Try another word, or a seller's name.",
              actionLabel: "Show all shops",
              onAction: () => onSearch(""),
            }
          : noShop
            ? {
                icon: <StorefrontOutlinedIcon />,
                title: "No shops yet",
                description: "Be the first to sell something.",
                actionLabel: "Open your own shop",
                onAction: openCreateShop,
              }
            : {
                icon: <StorefrontOutlinedIcon />,
                title: "No shops yet",
                description: "Shops that Qortal names open show up here.",
              };

  const busyText =
    home.more === "check" || (home.busy && payNeedsDetails(pay))
      ? `Checking which shops take ${payLabel(pay)}…`
      : "Loading more shops…";
  const sortLabel = SHOP_SORTS.find((s) => s.value === sort)?.label ?? "Newest";
  const showList = home.shops.length > 0 || home.more !== null || home.busy;

  // My shops before the signed-in name's shops are known: wait, rather than say there are none.
  const mineLoading = mine && myStores.length === 0 && (ownShopStatus === "idle" || ownShopStatus === "loading");

  let content;
  if (phase === "loading" || mineLoading) {
    content = <ShopGridSkeleton count={phone ? 3 : 8} label={sort === "newest" ? "Loading shops" : `Sorting by ${sortLabel}`} />;
  } else if (phase === "error") {
    content = (
      <EmptyState
        icon={<ErrorOutlineIcon />}
        title={home.searchFailed ? "The search didn't work" : "Couldn't load shops"}
        description="Check that your node is running, then try again."
        actionLabel="Retry"
        onAction={home.retry}
      />
    );
  } else if (!showList) {
    content = <EmptyState {...empty} />;
  } else {
    const card = (shop: ShopEntry) => (
      <StoreCard
        key={shop.key}
        shop={shop}
        mine={shop.owner === userName}
        rating={home.ratings ? home.ratings.get(shop.owner, shop.shortStoreId) : undefined}
        onOpen={prepareOpen}
        onMenu={onMenu}
      />
    );
    // The plain list carries the new-products strip after its first rows.
    const strip = !q && !filtersOn && home.shops.length > 0;
    const first = strip ? home.shops.slice(0, STRIP_AFTER) : home.shops;
    const rest = strip ? home.shops.slice(STRIP_AFTER) : [];
    content = (
      <>
        {home.searching && <LinearProgress aria-label="Searching" />}
        {first.length > 0 && (
          <ShopGridList aria-label={q ? `Shops matching ${q}` : "Shops"} aria-busy={home.searching || undefined}>
            {first.map(card)}
          </ShopGridList>
        )}
        {strip && <NewProductsStrip isListedShop={isListedShop} />}
        {rest.length > 0 && <ShopGridList aria-label="More shops">{rest.map(card)}</ShopGridList>}
        {home.more && !home.busy && (
          <LoadMoreSentinel
            key={`${home.more}:${home.shops.length}:${home.total}:${home.checked?.done ?? 0}`}
            onVisible={home.loadMore}
          />
        )}
        {(home.busy || home.more !== null) && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, py: 2 }}>
            {home.busy && <CircularProgress size={20} />}
            {home.busy ? (
              <Typography variant="body2" color="text.secondary">
                {busyText}
              </Typography>
            ) : (
              <Button variant="outlined" onClick={home.loadMore} sx={{ minHeight: 44 }}>
                {home.more === "check" ? "Check more shops" : "Show more shops"}
              </Button>
            )}
          </Box>
        )}
        {home.pageError && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 1, py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Couldn't load more shops.
            </Typography>
            <Button variant="outlined" onClick={home.retryPage} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          </Box>
        )}
        {home.shops.length > HOME_PAGE_SIZE && home.more === null && !home.busy && !home.pageError && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
            {home.indexIncomplete ? "That's the newest shops. Search to find others." : q ? "That's every match." : "That's every shop."}
          </Typography>
        )}
      </>
    );
  }

  return (
    <Page>
      {(pull > 0 || refreshing) && <PullIndicator pull={pull} refreshing={refreshing} />}
      <PageHeader title="Shops" subtitle={`Welcome to ${APP_NAME}: what the Qortal community has for sale.`} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 1.5, sm: 2 } }}>
        {noShop && (
          <Box
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
              px: 2,
              py: 1.5,
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
              bgcolor: accentWash(theme, 0.08),
            })}
          >
            <Typography sx={{ flex: "1 1 200px", fontWeight: 600 }}>Have something to sell?</Typography>
            <Button
              variant="contained"
              startIcon={<StorefrontOutlinedIcon />}
              onClick={openCreateShop}
              sx={{ minHeight: 44 }}
            >
              Open your own shop
            </Button>
          </Box>
        )}
        <ShopSearchField q={q} onSearch={onSearch} />
        {phone ? <SortFilterSheet {...controls} /> : <SortFilterRow {...controls} />}
        {home.indexIncomplete && !filtersOn && phase === "ready" && (
          <Typography variant="body2" color="text.secondary">
            Showing the newest {SHOP_INDEX_LIMIT} shops. Search to find others.
          </Typography>
        )}
        {home.sortFailed && (
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 220px" }}>
              Couldn't load what {sortLabel} needs, so the list is newest first.
            </Typography>
            <Button variant="outlined" onClick={home.retrySort} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          </Box>
        )}
        {home.filtered.unreadable > 0 && (
          <Typography variant="body2" color="text.secondary">
            {plural(home.filtered.unreadable, "shop", "shops")} couldn't be checked right now.
          </Typography>
        )}
        {content}
      </Box>
      <ShopMenu target={menu} onClose={() => setMenu(null)} onOpenShop={openShop} />
    </Page>
  );
};
