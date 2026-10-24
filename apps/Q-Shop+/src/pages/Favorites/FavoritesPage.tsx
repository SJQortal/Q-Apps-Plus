/**
 * The buyer's favourites (favorites/model.ts), opened from the heart beside
 * their name in the header: Shops and Products apart, each newest first.
 * Shops show as their cards (from the shop index, one cached search),
 * products as rows from their catalogues (cached, read as they come into
 * view). A favourite can be removed here, from its shop's menu or its row.
 */
import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useInView } from "react-intersection-observer";
import { Box, Link, Skeleton, Tab, Tabs, Typography } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import type { RootState } from "../../state/store";
import { Page, PageHeader } from "../../components/layout/Page";
import { EmptyState } from "../../components/common/EmptyState";
import { ProductImage } from "../../components/common/ProductImage";
import { AmountTag } from "../../components/money/PriceTag";
import { useShellActions } from "../../components/layout/shellState";
import { StoreCard } from "../Store/StoreCard/StoreCard";
import { ShopGridList, ShopGridSkeleton } from "../../discovery/ShopGrid";
import { ShopMenu, type ShopMenuTarget } from "../../discovery/ShopMenu";
import { loadShopIndex, peekShopIndex, type ShopEntry, type ShopIndex } from "../../discovery/shopIndex";
import { FavoriteButton } from "../../favorites/FavoriteButton";
import { useFavorites } from "../../favorites/useFavorites";
import type { FavoriteProduct, FavoriteShop } from "../../favorites/model";
import { productPath, storePath } from "../../qdn/links";
import { qortPrice } from "../../money/pricing";
import { useCatalogue } from "../Store/useShopData";

type TabKey = "shops" | "products";

function FavoriteProductRow({ fav, shopTitle }: { fav: FavoriteProduct; shopTitle: string }) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px", fallbackInView: true });
  return (
    <Box component="li" ref={ref} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper", minWidth: 0 }}>
      {inView ? <FavoriteProductDetails fav={fav} shopTitle={shopTitle} /> : <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />}
    </Box>
  );
}

function FavoriteProductDetails({ fav, shopTitle }: { fav: FavoriteProduct; shopTitle: string }) {
  const { catalogue, status } = useCatalogue(fav.owner, fav.catalogueId);
  const product = catalogue?.products?.[fav.productId] as Record<string, unknown> | undefined;
  const title = typeof product?.title === "string" && product.title.trim() ? product.title.trim() : "";
  const images: unknown[] = Array.isArray(product?.images) ? (product.images as unknown[]) : [];
  const picture = images[typeof product?.mainImageIndex === "number" ? product.mainImageIndex : 0] ?? images[0];
  const gone = !product && (status === "ready" || status === "missing" || status === "deleted" || status === "unavailable");
  return (
    <>
      <Box sx={{ width: 56, height: 56, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover", flexShrink: 0 }}>
        {typeof picture === "string" && <ProductImage src={picture} alt="" />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <Link component={RouterLink} to={productPath(fav.owner, fav.storeId, fav.productId, fav.catalogueId)} underline="hover" sx={{ fontWeight: 600, overflowWrap: "anywhere", color: "text.primary" }}>
            {title}
          </Link>
        ) : gone ? (
          <Typography color="text.secondary">{status === "unavailable" ? "Not available on your node right now" : "No longer in its shop"}</Typography>
        ) : (
          <Skeleton width="50%" />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          <Link component={RouterLink} to={storePath(fav.owner, fav.storeId)} color="inherit" underline="hover">
            {shopTitle || fav.owner}
          </Link>
        </Typography>
      </Box>
      {product && <AmountTag value={qortPrice(product as never)} coin="QORT" size="small" />}
      <FavoriteButton fav={fav} label={title || "this product"} />
    </>
  );
}

function MissingShopRow({ fav }: { fav: FavoriteShop }) {
  return (
    <Box component="li" sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Link component={RouterLink} to={storePath(fav.owner, fav.storeId)} underline="hover" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
          {fav.shortStoreId}
        </Link>
        <Typography variant="body2" color="text.secondary">
          by {fav.owner} · not in the shops list now
        </Typography>
      </Box>
      <FavoriteButton fav={fav} label={fav.shortStoreId} />
    </Box>
  );
}

export function FavoritesPage() {
  const navigate = useNavigate();
  const { signIn, authenticating } = useShellActions();
  const address = useSelector((state: RootState) => state.auth.user?.address);
  const { name, status, list, reload } = useFavorites();
  const [params, setParams] = useSearchParams();
  const tab: TabKey = params.get("tab") === "products" ? "products" : "shops";
  const [menu, setMenu] = useState<ShopMenuTarget | null>(null);
  const [index, setIndex] = useState<ShopIndex | null>(() => peekShopIndex());
  const [indexFailed, setIndexFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadShopIndex().then(
      (data) => alive && setIndex(data),
      () => alive && setIndexFailed(true)
    );
    return () => {
      alive = false;
    };
  }, []);

  // Newest change first (the store keeps them oldest first).
  const shops = useMemo(() => list.filter((f): f is FavoriteShop => f.kind === "shop").reverse(), [list]);
  const products = useMemo(() => list.filter((f): f is FavoriteProduct => f.kind === "product").reverse(), [list]);
  const byShop = useMemo(() => {
    const map = new Map<string, ShopEntry>();
    for (const shop of index?.shops ?? []) map.set(`${shop.owner}\n${shop.shortStoreId}`, shop);
    return map;
  }, [index]);
  const shopOf = (owner: string, shortStoreId: string) => byShop.get(`${owner}\n${shortStoreId}`);

  if (!name) {
    return (
      <Page width="list">
        <PageHeader title="Favourites" />
        <EmptyState
          icon={<FavoriteBorderIcon />}
          title={address ? "Favourites need a Qortal name" : "Sign in to see your favourites"}
          description={address ? "Register a name in Hub: your favourites are kept under it." : "Shops and products you keep show here, on every device."}
          actionLabel={!address && !authenticating ? "Sign in" : undefined}
          onAction={!address ? signIn : undefined}
        />
      </Page>
    );
  }

  const loading = status === "loading" || status === "idle";
  return (
    <Page width="grid">
      <PageHeader title="Favourites" subtitle="The shops and products you keep. Others can see them too: they count towards Most favourited." />
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, next: TabKey) => setParams(next === "shops" ? {} : { tab: next }, { replace: true })}
          aria-label="Favourites"
          sx={{ "& .MuiTab-root": { minHeight: 48, textTransform: "none", fontWeight: 600 } }}
        >
          <Tab value="shops" label={`Shops (${shops.length})`} id="favorites-tab-shops" aria-controls="favorites-panel-shops" />
          <Tab value="products" label={`Products (${products.length})`} id="favorites-tab-products" aria-controls="favorites-panel-products" />
        </Tabs>
      </Box>
      <Box role="tabpanel" id={`favorites-panel-${tab}`} aria-labelledby={`favorites-tab-${tab}`}>
        {status === "error" && list.length === 0 ? (
          <EmptyState title="Your favourites couldn't be read from your node" actionLabel="Try again" onAction={() => void reload()} />
        ) : tab === "shops" ? (
          shops.length === 0 ? (
            loading ? (
              <ShopGridSkeleton count={4} label="Loading your favourite shops" />
            ) : (
              <EmptyState icon={<FavoriteBorderIcon />} title="No favourite shops yet" description="Add one with the heart on its page, or from its card's menu." actionLabel="Browse shops" onAction={() => navigate("/")} />
            )
          ) : (
            <>
              <ShopGridList aria-label="Favourite shops">
                {shops.map((fav) => {
                  const shop = shopOf(fav.owner, fav.shortStoreId);
                  if (shop) return <StoreCard key={fav.identifier} shop={shop} mine={false} onOpen={() => {}} onMenu={(s, anchor) => setMenu({ shop: s, anchor })} />;
                  return index || indexFailed ? <MissingShopRow key={fav.identifier} fav={fav} /> : null;
                })}
              </ShopGridList>
              <ShopMenu target={menu} onClose={() => setMenu(null)} onOpenShop={(s) => navigate(storePath(s.owner, s.id))} />
            </>
          )
        ) : products.length === 0 ? (
          loading ? (
            <Skeleton variant="rounded" height={88} />
          ) : (
            <EmptyState icon={<FavoriteBorderIcon />} title="No favourite products yet" description="Add one with the heart on its page." actionLabel="Browse products" onAction={() => navigate("/products")} />
          )
        ) : (
          <Box component="ul" aria-label="Favourite products" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            {products.map((fav) => (
              <FavoriteProductRow key={fav.identifier} fav={fav} shopTitle={shopOf(fav.owner, fav.shortStoreId)?.title ?? ""} />
            ))}
          </Box>
        )}
      </Box>
    </Page>
  );
}
