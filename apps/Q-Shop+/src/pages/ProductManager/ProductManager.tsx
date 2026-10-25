/**
 * The seller's page for one of their shops (route `/product-manager/:store`,
 * the original's): a header with the shop's title, View shop and Copy link;
 * "Ready to publish" when there are drafts; and tabs, scrollable on phones:
 * Overview, Products, Collections, Orders, Reviews and Shop. The tab is kept
 * in `?tab=`.
 *
 * Publishing products: seller/usePublishProducts.ts builds the original's
 * catalogues and product index, seller/PublishProductsDialog.tsx sends them
 * (in batches past 20). Deleting products (select mode in the Products tab,
 * or Delete in a product's form): seller/DeleteProductsDialog.tsx asks, then
 * sends the same way. Nothing is ever published without the seller asking.
 */
import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Box, Button, IconButton, Skeleton, Tab, Tabs, Tooltip } from "@mui/material";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import type { AppDispatch, RootState } from "../../state/store";
import { setAllMyStores, type Store } from "../../state/features/storeSlice";
import { setOwnShopStatus, toggleCreateStoreModal, updateRecentlyVisitedStoreId } from "../../state/features/globalSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import { resetOrders } from "../../state/features/orderSlice";
import { Page, PageHeader } from "../../components/layout/Page";
import { EmptyState } from "../../components/common/EmptyState";
import { useShellActions } from "../../components/layout/shellState";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { findOwnShops, loadOwnShop } from "../../hooks/useOwnShops";
import { decodeParam, storeLink, storePath } from "../../qdn/links";
import { copyText } from "../../utils/clipboard";
import { ProductDialog } from "./NewProduct/NewProduct";
import type { ProductFormValues } from "../../seller/productDraft";
import { SellerOverview } from "./SellerOverview";
import { OrdersTab } from "./OrdersTab";
import { ReviewsPanel } from "../Store/StoreReviews/ReviewsPanel";
import { ProductsTab } from "../../seller/ProductsTab";
import { DraftsCard } from "../../seller/DraftsCard";
import { ShopTab } from "../../seller/ShopTab";
import { CollectionsTab } from "../../seller/CollectionsTab";
import { ProductListStatus } from "../../seller/ProductListStatus";
import { FinishDeletesCard } from "../../seller/FinishDeletesCard";
import { DeleteProductsDialog, type ProductToDelete } from "../../seller/DeleteProductsDialog";
import { PublishProductsDialog } from "../../seller/PublishProductsDialog";
import { usePublishProducts } from "../../seller/usePublishProducts";
import { DeliveryTab } from "../../seller/DeliveryTab";
import { CENTRED_TABS, CENTRED_WIDTH, SELLER_TABS, TAB_LABEL, isSellerTab, type SellerTab } from "./sellerTabs";
import { useSellerGuideOnce } from "../../onboarding/Walkthrough";

type ProductDialogState = { key: number; product: (Record<string, any> & { id: string }) | null; copy?: ProductFormValues } | null;
type DeleteRequest = { key: number; products: ProductToDelete[]; onDeleted?: () => void } | null;

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
  const { signIn, authenticating } = useShellActions();
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const ownShopStatus = useSelector((state: RootState) => state.global.ownShopStatus);
  const myStores = useSelector((state: RootState) => state.store.myStores);
  const [productDialog, setProductDialog] = useState<ProductDialogState>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest>(null);
  const publish = usePublishProducts();

  const isCurrent = !!currentStore && currentStore.id === storeId;
  const routedShop = myStores.find((s) => s.id === storeId);
  const ready = isCurrent && !!dataContainer && dataContainer.storeId === storeId;
  // How selling works, once, over the seller's first look at their shop (onboarding/tours.tsx).
  useSellerGuideOnce(ready);

  // The routed shop is one of the seller's but not the current one: make it
  // current the way the rest of the app does, through the recently visited
  // shop that useOwnShops follows. Asked again whenever the current shop
  // moves away from it (Back from another of the seller's shops); if it
  // can't be read, the status card says so.
  const routedId = routedShop?.id;
  const currentId = currentStore?.id;
  useEffect(() => {
    if (!routedId || routedId === currentId) return;
    dispatch(updateRecentlyVisitedStoreId(routedId));
  }, [routedId, currentId, dispatch]);

  // Leaving the seller page forgets the received orders, as the original did.
  useEffect(() => {
    return () => {
      dispatch(resetOrders());
    };
  }, [dispatch]);

  const setTab = useCallback(
    (next: string, extra?: Record<string, string>) => {
      if (!isSellerTab(next)) return;
      const params = new URLSearchParams(searchParams);
      params.set("tab", next);
      for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const openAdd = useCallback(() => setProductDialog({ key: Date.now(), product: null }), []);
  const openEdit = useCallback(
    (product: Record<string, any> & { id: string }) => setProductDialog({ key: Date.now(), product }),
    []
  );
  const askDelete = useCallback(
    (products: ProductToDelete[], onDeleted?: () => void) => setDeleteRequest({ key: Date.now(), products, onDeleted }),
    []
  );
  // From the product form: the form closes once the product is deleted.
  const askDeleteFromForm = useCallback(
    (products: ProductToDelete[]) => askDelete(products, () => setProductDialog(null)),
    [askDelete]
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
        if (!shop || (await loadOwnShop(dispatch, shop, { fresh: true })) === "deleted") {
          if (shop) dispatch(setAllMyStores(shops.filter((s) => s.id !== shop.id)));
          dispatch(setOwnShopStatus("none"));
        }
      } catch {
        dispatch(setOwnShopStatus("error"));
      }
      return;
    }
    if ((await loadOwnShop(dispatch, routedShop as Store, { fresh: true })) === "deleted") {
      dispatch(setAllMyStores(myStores.filter((s) => s.id !== routedShop.id)));
      dispatch(setOwnShopStatus("none"));
    }
  }, [userName, ownShopStatus, routedShop, myStores, storeId, dispatch]);

  const onReload = useCallback(() => void reload(), [reload]);

  const copyLink = async () => {
    if (!currentStore) return;
    const link = storeLink(currentStore.owner || user?.name || "", currentStore.id);
    const ok = await copyText(link);
    dispatch(setNotification(ok ? { alertType: "success", msg: "Link copied" } : { alertType: "info", msg: link }));
  };

  if (!user?.name) {
    // The header shows no Sign in while the account request is out, nor for an
    // account without a name, so the page says what applies and offers its own.
    return (
      <Page width="list">
        <PageHeader title="Your shop" back />
        {authenticating ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }} aria-busy="true" aria-label="Loading your account">
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={72} />
          </Box>
        ) : user ? (
          <EmptyState
            title="Register a Qortal name in Hub to sell"
            description="A shop is published under a Qortal name. Once your account has one, your shop is managed here."
          />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <EmptyState title="Sign in to manage your shop" description="Your shop is published under your Qortal name." />
            <Button variant="contained" onClick={signIn} sx={{ alignSelf: "center", minHeight: 44 }}>
              Sign in
            </Button>
          </Box>
        )}
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
        <DraftsCard
          onEdit={openEdit}
          onPublish={() => void publish.prepare()}
          preparing={publish.preparing}
          error={publish.error}
          notice={publish.notice}
        />
        <FinishDeletesCard />
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            // MUI's "auto" measured the bar as overflowing on some loads at 1280 px (arrows beside tabs that fit); phones scroll it by touch.
            scrollButtons={false}
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
        <Box
          role="tabpanel"
          id={`seller-panel-${tab}`}
          aria-labelledby={`seller-tab-${tab}`}
          sx={{ minWidth: 0, ...(CENTRED_TABS.has(tab) && { width: "100%", maxWidth: CENTRED_WIDTH, mx: "auto" }) }}
        >
          {tab === "overview" && <SellerOverview {...overviewProps} />}
          {tab === "products" && (
            <ProductsTab
              ready={ready}
              loading={ownShopStatus === "idle" || ownShopStatus === "loading" || ownShopStatus === "ready"}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={askDelete}
            />
          )}
          {tab === "collections" && (
            <CollectionsTab
              ready={ready}
              loading={ownShopStatus === "idle" || ownShopStatus === "loading" || ownShopStatus === "ready"}
            />
          )}
          {tab === "orders" && <OrdersTab />}
          {tab === "reviews" && (
            <ReviewsPanel storeId={currentStore.id} storeTitle={currentStore.title} storeImage={currentStore.logo || ""} />
          )}
          {tab === "delivery" && <DeliveryTab ready={ready} />}
          {tab === "shop" && <ShopTab />}
        </Box>
      </Box>

      {productDialog && (
        <ProductDialog
          key={productDialog.key}
          open
          product={productDialog.product}
          initialValues={productDialog.copy}
          onClose={() => setProductDialog(null)}
          onDelete={askDeleteFromForm}
          onDuplicate={(copy) => setProductDialog({ key: Date.now(), product: null, copy })}
        />
      )}
      {deleteRequest && (
        <DeleteProductsDialog
          key={deleteRequest.key}
          products={deleteRequest.products}
          onClose={() => setDeleteRequest(null)}
          onDeleted={deleteRequest.onDeleted}
        />
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
