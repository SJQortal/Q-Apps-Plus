/**
 * The seller's page for one of their shops (route `/product-manager/:store`,
 * the original's): a header with the shop's title, View shop and Copy link;
 * "Ready to publish" when there are drafts; and tabs, scrollable on phones:
 * Overview, Products, Orders, Reviews and Shop. The tab is kept in `?tab=`.
 *
 * Publishing products: seller/usePublishProducts.ts builds the original's
 * catalogues and product index, seller/PublishProductsDialog.tsx sends them
 * (in batches past 20). Nothing is ever published without the seller asking.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Box, Button, IconButton, Skeleton, Tab, Tabs, Tooltip } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import type { AppDispatch, RootState } from "../../state/store";
import { setAllMyStores, type Store } from "../../state/features/storeSlice";
import { setOwnShopStatus, toggleCreateStoreModal } from "../../state/features/globalSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import { resetOrders } from "../../state/features/orderSlice";
import { Page, PageHeader } from "../../components/layout/Page";
import { EmptyState } from "../../components/common/EmptyState";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { findOwnShops, loadOwnShop } from "../../hooks/useOwnShops";
import { decodeParam, storeLink, storePath } from "../../qdn/links";
import { copyText } from "../../utils/clipboard";
import { ProductDialog } from "./NewProduct/NewProduct";
import { SellerOverview } from "./SellerOverview";
import { OrdersTab } from "./OrdersTab";
import { ReviewsPanel } from "../Store/StoreReviews/ReviewsPanel";
import { ProductsTab } from "../../seller/ProductsTab";
import { DraftsCard } from "../../seller/DraftsCard";
import { ShopTab } from "../../seller/ShopTab";
import { ProductListStatus } from "../../seller/ProductListStatus";
import { PublishProductsDialog } from "../../seller/PublishProductsDialog";
import { usePublishProducts } from "../../seller/usePublishProducts";

export const SELLER_TABS = ["overview", "products", "orders", "reviews", "shop"] as const;
export type SellerTab = (typeof SELLER_TABS)[number];
const TAB_LABEL: Record<SellerTab, string> = {
  overview: "Overview",
  products: "Products",
  orders: "Orders",
  reviews: "Reviews",
  shop: "Shop",
};

function isSellerTab(value: string | null): value is SellerTab {
  return !!value && (SELLER_TABS as readonly string[]).includes(value);
}

type ProductDialogState = { key: number; product: (Record<string, any> & { id: string }) | null } | null;

export const ProductManager = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const { store: storeParam } = useParams();
  const storeId = decodeParam(storeParam);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: SellerTab = isSellerTab(tabParam) ? tabParam : "overview";

  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const ownShopStatus = useSelector((state: RootState) => state.global.ownShopStatus);
  const myStores = useSelector((state: RootState) => state.store.myStores);
  const [productDialog, setProductDialog] = useState<ProductDialogState>(null);
  const publish = usePublishProducts();

  const isCurrent = !!currentStore && currentStore.id === storeId;
  const routedShop = myStores.find((s) => s.id === storeId);
  const ready = isCurrent && !!dataContainer && dataContainer.storeId === storeId;

  // The routed shop is one of the seller's but not the current one: make it
  // current (once; if it can't be read, the status card says so).
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (isCurrent || !routedShop || asked.current === routedShop.id) return;
    asked.current = routedShop.id;
    void loadOwnShop(dispatch, routedShop);
  }, [isCurrent, routedShop, dispatch]);

  // Leaving the seller page forgets the received orders, as the original did.
  useEffect(() => {
    return () => {
      dispatch(resetOrders());
    };
  }, [dispatch]);

  const setTab = useCallback(
    (next: string) => {
      if (!isSellerTab(next)) return;
      const params = new URLSearchParams(searchParams);
      params.set("tab", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const openAdd = useCallback(() => setProductDialog({ key: Date.now(), product: null }), []);
  const openEdit = useCallback(
    (product: Record<string, any> & { id: string }) => setProductDialog({ key: Date.now(), product }),
    []
  );

  /** Reads the shop and its product index again, fresh from the node. */
  const userName = user?.name;
  const reload = useCallback(async () => {
    if (!userName) return;
    if (ownShopStatus === "error" || !routedShop) {
      dispatch(setOwnShopStatus("loading"));
      try {
        const shops = await findOwnShops(userName, true);
        dispatch(setAllMyStores(shops));
        const shop = shops.find((s) => s.id === storeId) ?? shops[0];
        if (shop) await loadOwnShop(dispatch, shop, { fresh: true });
        else dispatch(setOwnShopStatus("none"));
      } catch {
        dispatch(setOwnShopStatus("error"));
      }
      return;
    }
    await loadOwnShop(dispatch, routedShop as Store, { fresh: true });
  }, [userName, ownShopStatus, routedShop, storeId, dispatch]);

  const onReload = useCallback(() => void reload(), [reload]);

  const copyLink = async () => {
    if (!currentStore) return;
    const link = storeLink(currentStore.owner || user?.name || "", currentStore.id);
    const ok = await copyText(link);
    dispatch(setNotification(ok ? { alertType: "success", msg: "Link copied" } : { alertType: "info", msg: link }));
  };

  if (!user?.name) {
    return (
      <Page width="list">
        <PageHeader title="Your shop" back />
        <EmptyState title="Sign in to manage your shop" description="Use Sign in at the top to load your Qortal name." />
      </Page>
    );
  }

  if (!isCurrent) {
    const loading = ownShopStatus === "idle" || ownShopStatus === "loading";
    // One of the seller's shops that couldn't be read (its JSON isn't on the node).
    const routedFailed = !!routedShop && (ownShopStatus === "unavailable" || ownShopStatus === "error");
    const settled = !loading && (!routedShop || routedFailed);
    return (
      <Page width="grid">
        <PageHeader title={routedShop?.title || "Your shop"} back />
        {!settled ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }} aria-busy="true" aria-label="Loading your shop">
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={72} />
            <Skeleton variant="rounded" height={72} />
          </Box>
        ) : routedFailed ? (
          <EmptyState
            title="Couldn't load this shop from your node"
            description="It may still be on its way from peers."
            actionLabel="Retry"
            onAction={onReload}
          />
        ) : ownShopStatus === "none" ? (
          <EmptyState
            title="You don't have a shop yet"
            description="Create one to start selling. It's published under your name."
            actionLabel="Create your shop"
            onAction={() => dispatch(toggleCreateStoreModal(true))}
          />
        ) : ownShopStatus === "error" ? (
          <EmptyState title="Couldn't load your shops" description="Your node didn't answer." actionLabel="Retry" onAction={() => void reload()} />
        ) : (
          <EmptyState
            title="This isn't one of your shops"
            description="Only the shop's owner can manage it."
            actionLabel={currentStore ? "Go to your shop" : undefined}
            onAction={currentStore ? () => navigate(`/product-manager/${encodeURIComponent(currentStore.id)}`) : undefined}
          />
        )}
      </Page>
    );
  }

  const owner = currentStore.owner || user.name;
  const shopUrl = storePath(owner, currentStore.id);
  const actions = phone ? (
    <>
      <Tooltip title="View shop">
        <IconButton aria-label="View shop" onClick={() => navigate(shopUrl)} sx={{ width: 44, height: 44 }}>
          <StorefrontOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Copy link">
        <IconButton aria-label="Copy shop link" onClick={() => void copyLink()} sx={{ width: 44, height: 44 }}>
          <LinkOutlinedIcon />
        </IconButton>
      </Tooltip>
    </>
  ) : (
    <>
      <Button variant="outlined" startIcon={<StorefrontOutlinedIcon />} onClick={() => navigate(shopUrl)} sx={{ minHeight: 44 }}>
        View shop
      </Button>
      <Button color="inherit" startIcon={<LinkOutlinedIcon />} onClick={() => void copyLink()} sx={{ minHeight: 44 }}>
        Copy link
      </Button>
    </>
  );
  const overviewProps = { storeId: currentStore.id, onOpenTab: setTab };

  return (
    <Page width="grid">
      <PageHeader title={currentStore.title || "Your shop"} subtitle="Your shop" back backTo={shopUrl} actions={actions} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {!ready && <ProductListStatus status={ownShopStatus} onReload={onReload} />}
        <DraftsCard onEdit={openEdit} onPublish={() => void publish.prepare()} preparing={publish.preparing} error={publish.error} />
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Seller tools"
            sx={{ "& .MuiTab-root": { minHeight: 48, minWidth: 0, px: { xs: 1.5, sm: 2 }, textTransform: "none", fontWeight: 600 } }}
          >
            {SELLER_TABS.map((t) => (
              <Tab
                key={t}
                value={t}
                label={TAB_LABEL[t]}
                id={`seller-tab-${t}`}
                aria-controls={t === tab ? `seller-panel-${t}` : undefined}
              />
            ))}
          </Tabs>
        </Box>
        <Box role="tabpanel" id={`seller-panel-${tab}`} aria-labelledby={`seller-tab-${tab}`} sx={{ minWidth: 0 }}>
          {tab === "overview" && <SellerOverview {...overviewProps} />}
          {tab === "products" && (
            <ProductsTab
              ready={ready}
              loading={ownShopStatus === "idle" || ownShopStatus === "loading" || ownShopStatus === "ready"}
              onAdd={openAdd}
              onEdit={openEdit}
            />
          )}
          {tab === "orders" && <OrdersTab />}
          {tab === "reviews" && (
            <ReviewsPanel storeId={currentStore.id} storeTitle={currentStore.title} storeImage={currentStore.logo || ""} />
          )}
          {tab === "shop" && <ShopTab />}
        </Box>
      </Box>

      {productDialog && (
        <ProductDialog key={productDialog.key} open product={productDialog.product} onClose={() => setProductDialog(null)} />
      )}
      {publish.job && (
        <PublishProductsDialog
          open
          resources={publish.job.resources}
          labels={publish.job.labels}
          publicKey={user.publicKey}
          onDone={publish.done}
          onClose={publish.closed}
        />
      )}
    </Page>
  );
};
