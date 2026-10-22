/**
 * One product: `/:user/:store/:product/:catalogue` (the original's route).
 *
 * The product lives in its catalogue (DOCUMENT, up to 10 products); a list
 * that already read the catalogue hands it over, otherwise it is fetched, as
 * the original did. The shop's JSON comes from the session cache for the
 * coin picker and the shop link. A deep link no longer bounces to the shop
 * page first. The description is plain text (never HTML).
 */
import { useState, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { Alert, Box, Button, Chip, Divider, IconButton, InputBase, Link, Skeleton, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { setProductToCart, MAX_QUANTITY } from "../../state/features/cartSlice";
import { Page, PageHeader } from "../../components/layout/Page";
import { EmptyState } from "../../components/common/EmptyState";
import { ImageGallery } from "../../components/common/TabImageList/ImageGallery";
import { PriceTag } from "../../components/money/PriceTag";
import { useShopCoin } from "../../money/useShopCoin";
import { decodeParam, productLink, storePath } from "../../qdn/links";
import { AVAILABLE, OUT_OF_STOCK, RETIRED } from "../../constants/product-status";
import { useCatalogue, useViewedShop } from "../Store/useShopData";
import { CoinPicker, RateNote } from "../Store/CoinPicker";
import { CopyLinkButton } from "../Store/CopyLinkButton";
import { AddedToCartSnackbar, CartButton, type AddedNotice } from "../Store/CartBits";
import { visuallyHiddenSx } from "../Store/a11y";
import { LocalBoundary } from "../Store/LocalBoundary";

const FETCHING_NOTE = "Fetching from peers…";

/** The quantity a typed value stands for: a whole number from 1 to 99. */
export function clampQuantity(value: string | number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_QUANTITY);
}

function QuantityStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const quantity = clampQuantity(value);
  return (
    <Box
      role="group"
      aria-label="Quantity"
      sx={{ display: "inline-flex", alignItems: "center", border: 1, borderColor: "divider", borderRadius: 2, flexShrink: 0 }}
    >
      <IconButton aria-label="Decrease quantity" onClick={() => onChange(String(clampQuantity(quantity - 1)))} disabled={quantity <= 1} sx={{ width: 44, height: 44 }}>
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
        onClick={() => onChange(String(clampQuantity(quantity + 1)))}
        disabled={quantity >= MAX_QUANTITY}
        sx={{ width: 44, height: 44 }}
      >
        <AddIcon />
      </IconButton>
    </Box>
  );
}

function ProductSkeleton({ note }: { note?: string }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 4 } }}>
      <Skeleton variant="rounded" sx={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }} />
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

function stockLine(status: string | undefined) {
  if (status === AVAILABLE)
    return (
      <Typography sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontWeight: 600 }}>
        <CheckCircleOutlinedIcon fontSize="small" color="success" aria-hidden />
        In stock
      </Typography>
    );
  if (status === OUT_OF_STOCK) return <Alert severity="warning">Out of stock: it can't be ordered right now.</Alert>;
  if (status === RETIRED) return <Alert severity="info">This product is retired and no longer for sale.</Alert>;
  return null;
}

function ProductView({ owner, storeId, productId, catalogueId }: { owner: string; storeId: string; productId: string; catalogueId: string }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { shop, isOwner } = useViewedShop(owner, storeId, { products: false });
  const { catalogue, status, retry } = useCatalogue(owner, catalogueId);
  const shopCoin = useShopCoin(shop);
  const [quantityText, setQuantityText] = useState("1");
  const [added, setAdded] = useState<AddedNotice | null>(null);
  const product = catalogue?.products?.[productId];
  const shopPath = storePath(owner, storeId);
  const shopName = shop?.title || "the shop";

  // Catalogues are JSON any seller writes: only text is shown as a title.
  const productTitle = typeof product?.title === "string" ? product.title.trim() : "";
  let title: ReactNode = productTitle || "Product";
  let content: ReactNode;
  if (status === "loading" || status === "fetching") {
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
    const available = product.status === AVAILABLE;
    const quantity = clampQuantity(quantityText);
    const mainIndex = typeof product.mainImageIndex === "number" ? product.mainImageIndex : 0;
    const addToCart = () => {
      dispatch(setProductToCart({ storeId, storeOwner: owner, productId, catalogueId, quantity }));
      setAdded((prev) => ({ at: (prev?.at ?? 0) + 1, title: name, quantity }));
    };
    content = (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" },
          gap: { xs: 2, md: 4 },
          alignItems: "start",
        }}
      >
        <ImageGallery images={product.images} title={name} initialIndex={mainIndex} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {product.type && <Chip size="small" variant="outlined" label={product.type === "physical" ? "Physical" : "Digital"} />}
            {product.category && <Chip size="small" variant="outlined" label={product.category} />}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            <PriceTag product={product} coin={shopCoin.coin} rate={shopCoin.rate} shop={shop} size="large" />
            <CoinPicker shop={shop} shopCoin={shopCoin} id="product-coin" />
          </Box>
          <RateNote shopCoin={shopCoin} />
          {stockLine(product.status)}
          {isOwner ? (
            <Alert
              severity="info"
              action={
                <Button color="inherit" onClick={() => navigate(`/product-manager/${encodeURIComponent(storeId)}`)} sx={{ minHeight: 44 }}>
                  Seller page
                </Button>
              }
            >
              This is your product.
            </Alert>
          ) : available ? (
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
              <QuantityStepper value={quantityText} onChange={setQuantityText} />
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
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
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
            <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} color={product.description ? "text.primary" : "text.secondary"}>
              {product.description || "No description."}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Page width="grid">
      <PageHeader
        back
        backTo={shopPath}
        title={title}
        subtitle={
          <>
            From{" "}
            <Link component={RouterLink} to={shopPath} color="inherit" underline="always">
              {shopName}
            </Link>{" "}
            by {owner}
          </>
        }
        actions={!isOwner ? <CartButton /> : undefined}
      />
      {/* A product with data this page can't show leaves the header and navigation in place. */}
      <LocalBoundary
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
  return <ProductView key={[owner, storeId, productId, catalogueId].join("\n")} owner={owner} storeId={storeId} productId={productId} catalogueId={catalogueId} />;
};

export default ProductPage;
