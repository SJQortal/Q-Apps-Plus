/**
 * One product: `/:user/:store/:product/:catalogue` (the original's route).
 *
 * The product lives in its catalogue (DOCUMENT, up to 10 products); a list
 * that already read the catalogue hands it over, otherwise it is fetched, as
 * the original did. The shop's JSON comes from the session cache for the
 * coin picker and the shop link. A deep link no longer bounces to the shop
 * page first. The description shows the seller's formatting, videos and
 * files when it has them (richtext/ProductDescription.tsx), made safe first.
 *
 * The collections the product is in are named under its price, each a link
 * to that collection on the shop page (Follow-up 15): the shop's product
 * list (cached from the shop page) says whether it has collections, and only
 * then, once the product has loaded, is its collections document read (once
 * per session; it holds a picture per collection).
 *
 * A variant's items are one page: switching item (its picker, or one of its
 * pictures) swaps the product in place, so the gallery, its full-screen
 * viewer and the video under it stay as they are (variants/gallery.ts).
 */
import { shortStoreIdOf } from "../../qdn/identifiers";
import { productRowsFromContainer } from "../Store/shopData";
import { stockOf, type ProductStock } from "../../stock/model";
import { useStockLeft, type StockItem } from "../../stock/notes";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Chip, Divider, IconButton, InputBase, Link, Skeleton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { setProductToCart, MAX_QUANTITY } from "../../state/features/cartSlice";
import { Page, PageHeader } from "../../components/layout/Page";
import { EmptyState } from "../../components/common/EmptyState";
import { GALLERY_LANDSCAPE_WIDTH, ImageGallery } from "../../components/common/TabImageList/ImageGallery";
import { LANDSCAPE_PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { ShopPrices } from "../../components/money/ShopPrices";
import { useShopCoin } from "../../money/useShopCoin";
import { collectionPath, decodeParam, productLink, productPath, storePath } from "../../qdn/links";
import { AVAILABLE, OUT_OF_STOCK, RETIRED } from "../../constants/product-status";
import { useCatalogue, useCatalogueLoader, useViewedShop } from "../Store/useShopData";
import { useMorePictures } from "../../hooks/useMorePictures";
import { useLandAtTop } from "../../hooks/useLandAtTop";
import { ProductDescription, ProductMedia, useDescriptionParts } from "../../richtext/ProductDescription";
import { ShippingCountriesButton } from "../Store/ShippingCountries";
import { ProductDelivery, type DeliveryShop } from "../../delivery/ProductDelivery";
import { PolicyLines } from "../../shop/PolicyLines";
import { MoreFromShop } from "./MoreFromShop";
import { rememberViewed } from "../../discovery/recentlyViewed";
import { AwayNotice } from "../../shop/AwayNotice";
import type { CartLine } from "../../money/order";
import { useShopCollections } from "../Store/useShopCollections";
import { CopyLinkButton } from "../Store/CopyLinkButton";
import { FavoriteButton } from "../../favorites/FavoriteButton";
import { favoriteProduct } from "../../favorites/model";
import { AddedToCartSnackbar, CartButton, type AddedNotice } from "../Store/CartBits";
import { visuallyHiddenSx } from "../Store/a11y";
import { LocalBoundary } from "../Store/LocalBoundary";
import { CategoryIcon } from "../../components/CategoryIcon";
import { auctionTermsOf } from "../../auctions/rules";
import { valuesKey, variantOf, variantSiblings, type VariantSibling } from "../../variants/model";
import { MAX_GROUP_PICTURES, groupPictures, itemForPicture, pictureCaption, shownPicture, type GroupMember } from "../../variants/gallery";
import { VariantPicker } from "../../variants/VariantPicker";
import { lazyWithRetry } from "../../utils/lazyWithRetry";
import { namedAfterOwner } from "../../shop/owner";

// Only auction products need it (bids, countdown, the winner's checkout).
const AuctionPanel = lazyWithRetry(() => import("../../auctions/AuctionPanel").then((m) => ({ default: m.AuctionPanel })));

const FETCHING_NOTE = "Fetching from peers…";

/** The quantity a typed value stands for: a whole number from 1 to 99 (or to `max`, the units left). */
export function clampQuantity(value: string | number, max: number = MAX_QUANTITY): number {
  const n = Math.floor(Number(value));
  const top = Math.max(1, Math.min(max, MAX_QUANTITY));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, top);
}

function QuantityStepper({ value, onChange, max = MAX_QUANTITY }: { value: string; onChange: (value: string) => void; max?: number }) {
  const quantity = clampQuantity(value, max);
  return (
    <Box
      role="group"
      aria-label="Quantity"
      sx={{ display: "inline-flex", alignItems: "center", border: 1, borderColor: "divider", borderRadius: 2, flexShrink: 0 }}
    >
      <IconButton aria-label="Decrease quantity" onClick={() => onChange(String(clampQuantity(quantity - 1, max)))} disabled={quantity <= 1} sx={{ width: 44, height: 44 }}>
        <RemoveIcon />
      </IconButton>
      <InputBase
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => onChange(String(quantity))}
        inputProps={{
          inputMode: "numeric",
          pattern: "[0-9]*",
          "aria-label": "Quantity",
          enterKeyHint: "done",
          style: { textAlign: "center", width: 36, fontWeight: 600 },
        }}
      />
      <IconButton
        aria-label="Increase quantity"
        onClick={() => onChange(String(clampQuantity(quantity + 1, max)))}
        disabled={quantity >= Math.min(max, MAX_QUANTITY)}
        sx={{ width: 44, height: 44 }}
      >
        <AddIcon />
      </IconButton>
    </Box>
  );
}

/**
 * Pictures beside the details from md up; one column below. A phone held
 * sideways (the Hub frame is about 266 px tall) gets two columns too, the
 * gallery sized by the frame's height (GALLERY_LANDSCAPE_WIDTH), so the
 * price and Add to cart sit beside the picture instead of about three
 * frames below an 800 px square. Last, so it wins over the width rules.
 *
 * The description's videos and attachments show under the pictures (Simon,
 * 2026-10-22); in one column they come after the description, so the price
 * and Add to cart stay near the top, and on a phone held sideways under the
 * details, beside the picture.
 */
const productLayoutSx = {
  display: "grid",
  gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" },
  gridTemplateAreas: { xs: '"gallery" "details" "media"', md: '"gallery details" "media details"' },
  gridTemplateRows: { md: "auto 1fr" },
  gap: { xs: 2, md: 4 },
  alignItems: "start",
  [`@media ${LANDSCAPE_PHONE_MEDIA}`]: {
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gridTemplateAreas: '"gallery details" "gallery media"',
    gridTemplateRows: "auto 1fr",
    gap: 2,
  },
} as const;

function ProductSkeleton({ note }: { note?: string }) {
  return (
    <Box sx={productLayoutSx}>
      <Skeleton
        variant="rounded"
        sx={{
          width: "100%",
          height: "auto",
          aspectRatio: "1 / 1",
          [`@media ${LANDSCAPE_PHONE_MEDIA}`]: { width: GALLERY_LANDSCAPE_WIDTH },
        }}
      />
      <Box>
        <Skeleton width="40%" />
        <Skeleton width="30%" height={48} />
        <Skeleton variant="rounded" height={44} sx={{ my: 2 }} />
        <Skeleton />
        <Skeleton />
        <Skeleton width="60%" />
        {note && (
          <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 2 }}>
            {note}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/** `left`: the units left of a counted product (stock/model.ts); undefined when it isn't counted, or while they are read. */
function stockLine(status: string | undefined, left?: number) {
  if (status === AVAILABLE && left === 0) return <Alert severity="warning">Sold out: every unit has been ordered.</Alert>;
  if (status === AVAILABLE)
    return (
      <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontWeight: 600 }}>
        <CheckCircleOutlinedIcon fontSize="small" color="success" aria-hidden />
        {left === undefined ? "In stock" : `In stock · ${left.toLocaleString("en-US")} left`}
      </Typography>
    );
  if (status === OUT_OF_STOCK) return <Alert severity="warning">Out of stock: it can't be ordered right now.</Alert>;
  if (status === RETIRED) return <Alert severity="info">This product is retired and no longer for sale.</Alert>;
  return null;
}

function ProductView({ owner, storeId, productId, catalogueId }: { owner: string; storeId: string; productId: string; catalogueId: string }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { shop, shopStatus, isOwner, index } = useViewedShop(owner, storeId);
  // The seller sees their own product as a buyer does with `?view=customer`: the buyer's buttons
  // are shown but don't work (inert), so nothing is bought, bid on or saved from this view.
  const [searchParams, setSearchParams] = useSearchParams();
  const asCustomer = isOwner && searchParams.get("view") === "customer";
  const ownerView = isOwner && !asCustomer;
  const setCustomerView = (on: boolean) =>
    setSearchParams(
      (now) => {
        const next = new URLSearchParams(now);
        if (on) next.set("view", "customer");
        else next.delete("view");
        return next;
      },
      { replace: true }
    );
  const { catalogue, status, retry } = useCatalogue(owner, catalogueId);
  // Read after the product itself (its catalogue), never competing with it: a collections
  // document holds a picture per collection.
  const shopCollections = useShopCollections(owner, storeId, status === "ready" ? index : null);
  const inCollections = shopCollections.collections.filter((c) => c.products.includes(productId));
  const shopCoin = useShopCoin(shop);
  const [quantityText, setQuantityText] = useState("1");
  const [added, setAdded] = useState<AddedNotice | null>(null);
  // Another product on the same page (ProductPage keys it by shop): its quantity starts at one.
  const [shownProduct, setShownProduct] = useState(productId);
  if (shownProduct !== productId) {
    setShownProduct(productId);
    setQuantityText("1");
  }
  const product = catalogue?.products?.[productId];
  const auctionTerms = useMemo(() => auctionTermsOf(product), [product]);
  // A variant (variants/model.ts): its group's choices, and its pictures (variants/gallery.ts),
  // from every item's catalogue, read once the product's own is in.
  const variant = useMemo(() => variantOf(product), [product]);
  const variantGroup = variant?.group;
  const indexSiblings = useMemo(() => (variant ? variantSiblings(index, variant.group) : []), [index, variant]);
  // Counted stock (stock/model.ts): this product's and its variants' units left, from the shop's
  // order notes. The product's own count is its catalogue's; its variants' their list rows'.
  const ownStock = stockOf(product);
  const ownStockKey = JSON.stringify(ownStock);
  const stockItems = useMemo(() => {
    const short = shortStoreIdOf(storeId);
    const own = JSON.parse(ownStockKey) as ProductStock | null;
    const items: StockItem[] = own ? [{ shortStoreId: short, productId, stock: own }] : [];
    const others = new Set(indexSiblings.map((s) => s.productId));
    for (const row of productRowsFromContainer(index)) {
      if (row.stock && row.productId !== productId && others.has(row.productId)) items.push({ shortStoreId: short, productId: row.productId, stock: row.stock });
    }
    return items;
  }, [ownStockKey, index, indexSiblings, productId, storeId]);
  const { left: stockLeft } = useStockLeft(stockItems);
  const unitsLeft = ownStock ? stockLeft.get(productId) : undefined;
  // A sold-out variant shows as out of stock in the picker.
  const siblings = useMemo(
    () => indexSiblings.map((s) => (stockLeft.get(s.productId) === 0 && s.status === AVAILABLE ? { ...s, status: OUT_OF_STOCK } : s)),
    [indexSiblings, stockLeft]
  );
  // Each product opens at its top (hooks/useLandAtTop.ts); picking another item of the same variants stays put.
  const landing = useRef<HTMLDivElement>(null);
  const [landedGroup, setLandedGroup] = useState<{ key: string; ids: string[] }>({ key: productId, ids: [productId] });
  let group = landedGroup.ids.includes(productId) ? landedGroup : { key: productId, ids: [productId] };
  const siblingIds = siblings.map((s) => s.productId);
  if (siblingIds.includes(productId) && siblingIds.some((id) => !group.ids.includes(id))) group = { key: group.key, ids: [...new Set([...group.ids, ...siblingIds])] };
  if (group !== landedGroup) setLandedGroup(group);
  useLandAtTop(landing, group.key);
  const groupLoader = useCatalogueLoader(owner);
  const loadGroup = groupLoader.load;
  const groupCatalogues = status === "ready" ? [...new Set(siblings.map((s) => s.catalogueId))].join("|") : "";
  useEffect(() => {
    if (groupCatalogues) loadGroup(groupCatalogues.split("|"));
  }, [groupCatalogues, loadGroup]);
  const productOf = (s: VariantSibling) => (s.productId === productId ? product : groupLoader.catalogues[s.catalogueId]?.products?.[s.productId]);
  const leadEntry = variant ? siblings.find((s) => s.productId === variant.lead) : undefined;
  const leadProduct = leadEntry ? productOf(leadEntry) : undefined;
  // Pictures past the third, from their own document (qdn/productPictures.ts), after the catalogue's;
  // a variant's are its lead's, the product's.
  const morePictures = useMorePictures(
    owner,
    variant && leadEntry
      ? leadProduct
        ? { id: leadEntry.productId, morePictures: (leadProduct as { morePictures?: unknown }).morePictures }
        : null
      : product
        ? { id: productId, morePictures: (product as { morePictures?: unknown }).morePictures }
        : null
  );
  const members: GroupMember[] = [];
  if (variant) {
    for (const s of siblings) {
      const p = productOf(s);
      if (p) members.push({ values: s.values, images: p.images, lead: s.productId === variant.lead });
    }
    // Before the shop's list is in: the item itself.
    if (product && !siblings.some((s) => s.productId === productId)) members.push({ values: variant.values, images: product.images, lead: variant.lead === productId });
  }
  const gallery = variant ? groupPictures(variant.options, members, morePictures.images) : null;
  // The picture the buyer chose; the gallery shows it while it fits the item shown.
  const [chosenPicture, setChosenPicture] = useState<string | null>(null);
  const openItem = (next: VariantSibling) => navigate(productPath(owner, storeId, next.productId, next.catalogueId), { replace: true });
  const pickPicture = (i: number) => {
    const picture = gallery?.[i];
    if (!picture || !variant) return;
    setChosenPicture(picture.src);
    const item = itemForPicture(picture, variant.values);
    const next = item && siblings.find((s) => valuesKey(s.values) === valuesKey(item));
    // Each item is its own page (and link); Back still leaves for the list.
    if (next) openItem(next);
  };
  // Its description's text, and its videos and attachments (shown under the pictures).
  const descriptionParts = useDescriptionParts((product ?? {}) as { description?: unknown; htmlDescription?: unknown });
  const shopPath = storePath(owner, storeId);
  const shopName = shop?.title || "the shop";

  // Recently viewed (discovery/recentlyViewed.ts): a product someone else sells, once it shows.
  const shownToBuyer = !!product && !isOwner && status === "ready";
  useEffect(() => {
    if (shownToBuyer) rememberViewed({ owner, storeId, productId, catalogueId, group: variantGroup });
  }, [shownToBuyer, owner, storeId, productId, catalogueId, variantGroup]);

  // Catalogues are JSON any seller writes: only text is shown as a title.
  const productTitle = typeof product?.title === "string" ? product.title.trim() : "";
  let title: ReactNode = (variant?.title ?? productTitle) || "Product";
  let content: ReactNode;
  if (shopStatus === "deleted") {
    title = "Shop deleted";
    content = (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title="This shop was deleted"
        description={`${owner} deleted this shop and its products. Orders you placed there stay in My orders.`}
        actionLabel="Browse shops"
        onAction={() => navigate("/")}
      />
    );
  } else if (status === "loading" || status === "fetching") {
    title = (
      <>
        <Box component="span" sx={visuallyHiddenSx}>
          Loading product
        </Box>
        <Skeleton aria-hidden width="min(70%, 360px)" />
      </>
    );
    content = <ProductSkeleton note={status === "fetching" ? FETCHING_NOTE : undefined} />;
  } else if (status === "unavailable") {
    content = (
      <EmptyState
        icon={<CloudOffOutlinedIcon />}
        title="Not available on your node right now"
        description="This product hasn't reached your node yet."
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (!product) {
    title = "Product not found";
    content = (
      <EmptyState
        icon={<SearchOffOutlinedIcon />}
        title="This product isn't in the shop any more"
        description="The seller may have removed it, or the link is incomplete."
        actionLabel="Go to the shop"
        onAction={() => navigate(shopPath)}
      />
    );
  } else {
    const name = productTitle || "Product";
    const available = product.status === AVAILABLE && unitsLeft !== 0;
    const maxQuantity = unitsLeft ?? MAX_QUANTITY;
    const quantity = clampQuantity(quantityText, maxQuantity);
    const mainIndex = typeof product.mainImageIndex === "number" ? product.mainImageIndex : 0;
    const addToCart = () => {
      dispatch(setProductToCart({ storeId, storeOwner: owner, productId, catalogueId, quantity }));
      setAdded((prev) => ({ at: (prev?.at ?? 0) + 1, title: name, quantity }));
    };
    content = (
      <Box data-product-layout sx={productLayoutSx}>
        <Box sx={{ gridArea: "gallery", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          {gallery && variant ? (
            <ImageGallery
              images={gallery.map((p) => p.src)}
              captions={gallery.map((p) => pictureCaption(p, variant.options))}
              title={variant.title}
              max={MAX_GROUP_PICTURES}
              index={shownPicture(gallery, chosenPicture, variant.values)}
              onIndexChange={pickPicture}
            />
          ) : (
            <ImageGallery images={[...new Set([...(product.images ?? []), ...morePictures.images])]} title={name} initialIndex={mainIndex} />
          )}
          {morePictures.status === "failed" && (
            <Box
              role="status"
              sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, [`@media ${LANDSCAPE_PHONE_MEDIA}`]: { maxWidth: GALLERY_LANDSCAPE_WIDTH } }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 160px" }}>
                {morePictures.count === 1 ? "1 more picture" : `${morePictures.count} more pictures`} couldn't be loaded from your node.
              </Typography>
              <Button variant="outlined" color="inherit" size="small" onClick={morePictures.retry} sx={{ minHeight: 44 }}>
                Try again
              </Button>
            </Box>
          )}
        </Box>
        <Box sx={{ gridArea: "details", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {product.type && <Chip size="small" variant="outlined" label={product.type === "physical" ? "Physical" : "Digital"} />}
            {product.category && (
              <Chip size="small" variant="outlined" label={product.category} icon={<CategoryIcon category={product.category} size={18} round />} sx={{ "& .MuiChip-icon": { ml: "3px", mr: "-2px" } }} />
            )}
          </Box>
          {auctionTerms ? (
            <Suspense fallback={<Skeleton variant="rounded" height={220} aria-label="Loading the auction" />}>
              <AuctionPanel
                key={productId}
                terms={auctionTerms}
                product={product as unknown as Record<string, unknown>}
                productId={productId}
                catalogueId={catalogueId}
                owner={owner}
                storeId={storeId}
                shop={shop}
                isOwner={ownerView}
                preview={asCustomer}
              />
            </Suspense>
          ) : (
            <>
              {/* Every coin the shop takes (the buyer's first); checkout's Pays in picks the coin. */}
              <ShopPrices product={product} shop={shop} preferred={shopCoin.coin} />
            </>
          )}
          {variant && siblings.length > 1 && (
            <VariantPicker
              options={variant.options}
              values={variant.values}
              siblings={siblings}
              onPick={(next) => {
                setChosenPicture(null);
                openItem(next);
              }}
            />
          )}
          {inCollections.length > 0 && (
            <Box component="nav" aria-label="Collections" sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                In:
              </Typography>
              {inCollections.map((c) => (
                <Chip
                  key={c.id}
                  component={RouterLink}
                  to={collectionPath(owner, storeId, c.id)}
                  clickable
                  variant="outlined"
                  label={c.title}
                  sx={{ height: 44, borderRadius: 22, maxWidth: "100%", "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }}
                />
              ))}
            </Box>
          )}
          {/* An auction is stored out of stock for the original app; its panel says where it stands (a retired one says so). */}
          {(!auctionTerms || product.status === RETIRED) && stockLine(product.status, auctionTerms ? undefined : unitsLeft)}
          {/* Away for a while (shop/away.ts): before adding it to the cart. */}
          <AwayNotice shop={shop as { away?: unknown; title?: string } | null} />
          {ownerView ? (
            <Alert
              severity="info"
              action={
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {/* The seller page opens the product's form (seller/ProductsTab.tsx `edit`); an item in variants opens its whole product. */}
                  <Button
                    color="inherit"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => navigate(`/product-manager/${encodeURIComponent(storeId)}?tab=products&edit=${encodeURIComponent(productId)}`)}
                    sx={{ minHeight: 44 }}
                  >
                    Edit product
                  </Button>
                  <Button color="inherit" startIcon={<VisibilityOutlinedIcon />} onClick={() => setCustomerView(true)} sx={{ minHeight: 44 }}>
                    View as customer
                  </Button>
                </Box>
              }
            >
              This is your product.
            </Alert>
          ) : auctionTerms ? null : available ? (
            <Box inert={asCustomer} sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <QuantityStepper value={quantityText} onChange={setQuantityText} max={maxQuantity} />
              <Button
                variant="contained"
                size="large"
                startIcon={<AddShoppingCartOutlinedIcon />}
                onClick={addToCart}
                sx={{ minHeight: 48, flex: "1 1 180px" }}
              >
                Add to cart
              </Button>
            </Box>
          ) : null}
          {/* For something it ships: what delivery costs to the buyer's country, and where the shop ships (delivery/ProductDelivery.tsx). */}
          {product.type !== "digital" && !auctionTerms && (
            <ProductDelivery
              owner={owner}
              storeId={storeId}
              shop={shop as DeliveryShop | null}
              line={{ productId, catalogueId, quantity, product: product as CartLine["product"] }}
            />
          )}
          {/* The shop's dispatch time and returns (shop/policies.ts). */}
          <PolicyLines shop={shop as { policies?: unknown; title?: string } | null} digital={product.type === "digital"} />
          {product.type !== "digital" && auctionTerms && typeof shop?.shipsTo === "string" && shop.shipsTo && (
            <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
              <LocalShippingOutlinedIcon fontSize="small" aria-hidden />
              <span>
                Ships to {shop.shipsTo} <ShippingCountriesButton shop={shop as { shippingCountries?: unknown; shippingStates?: unknown; title?: string }} />
              </span>
            </Typography>
          )}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {!ownerView && (
              <Box component="span" inert={asCustomer} sx={{ display: "contents" }}>
                <FavoriteButton fav={favoriteProduct(owner, storeId, productId, catalogueId)} label={productTitle || "this product"} variant="button" />
              </Box>
            )}
            <CopyLinkButton link={productLink(owner, storeId, productId, catalogueId)} label="Share" />
            <Button component={RouterLink} to={shopPath} variant="outlined" color="inherit" startIcon={<StorefrontOutlinedIcon />} sx={{ minHeight: 44 }}>
              Visit shop
            </Button>
          </Box>
          <Divider />
          <Box component="section" aria-labelledby="product-description-heading">
            <Typography id="product-description-heading" component="h2" sx={{ fontSize: 18, fontWeight: 700, mb: 1 }}>
              Description
            </Typography>
            <ProductDescription parts={descriptionParts} />
          </Box>
        </Box>
        {(descriptionParts.videos.length > 0 || descriptionParts.attachments.length > 0) && (
          <Box sx={{ gridArea: "media", minWidth: 0 }}>
            <ProductMedia parts={descriptionParts} />
          </Box>
        )}
      </Box>
    );
    // The shop's other products under it (MoreFromShop.tsx), read once they near the screen.
    content = (
      <>
        {content}
        <MoreFromShop owner={owner} storeId={storeId} shopTitle={shop?.title || owner} index={index} productId={productId} group={variant?.group} />
      </>
    );
  }

  return (
    <Page width="grid">
      <Box ref={landing}>
        <PageHeader
          back
          backTo={shopPath}
          title={title}
          subtitle={
            <>
              From{" "}
              <Link component={RouterLink} to={shopPath} color="inherit" underline="always">
                {shopName}
              </Link>
              {!namedAfterOwner(shopName, owner) && ` by ${owner}`}
            </>
          }
          actions={!ownerView ? <CartButton /> : undefined}
        />
        {asCustomer && (
          <Alert
            severity="info"
            role="status"
            action={
              <Button color="inherit" startIcon={<ArrowBackOutlinedIcon />} onClick={() => setCustomerView(false)} sx={{ minHeight: 44 }}>
                Back to your view
              </Button>
            }
            sx={{ mb: 2 }}
          >
            This is how buyers see your product. Their buttons are shown but don&apos;t work here.
          </Alert>
        )}
        {/* A product with data this page can't show leaves the header and navigation in place. */}
        {/* A new boundary (and content) for another product; a variant's items share one. */}
        <LocalBoundary
          key={variant ? `group\n${variant.group}` : `product\n${catalogueId}\n${productId}`}
          label={`The product ${productId}`}
          fallback={
            <EmptyState
              icon={<SearchOffOutlinedIcon />}
              title="This product couldn't be shown"
              description="Its listing has data this app can't read."
              actionLabel="Go to the shop"
              onAction={() => navigate(shopPath)}
            />
          }
        >
          {content}
        </LocalBoundary>
      </Box>
      <AddedToCartSnackbar notice={added} onClose={() => setAdded(null)} />
    </Page>
  );
}

export const ProductPage = () => {
  const params = useParams();
  const owner = decodeParam(params.user);
  const storeId = decodeParam(params.store);
  const productId = decodeParam(params.product);
  const catalogueId = decodeParam(params.catalogue);
  return <ProductView key={[owner, storeId].join("\n")} owner={owner} storeId={storeId} productId={productId} catalogueId={catalogueId} />;
};

export default ProductPage;
