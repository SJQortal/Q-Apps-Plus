/**
 * A product on the shop page: picture, title, price in the shop's chosen coin
 * (money/ computes it, exactly as checkout will), stock, and Add to cart.
 * A tile (picture on top) or a row (picture on the left, and on wider
 * screens the start of the description), as the buyer's product view says
 * (utils/productView.ts). Right-click copies the product's link.
 */
import { Box, Button, Chip, Link, Skeleton, Typography } from "@mui/material";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { Link as RouterLink } from "react-router-dom";
import type { Product } from "../../../state/features/storeSlice";
import type { ShopCoinSettings } from "../../../money/coins";
import { PriceTag } from "../../../components/money/PriceTag";
import { productLink, productPath } from "../../../qdn/links";
import { AVAILABLE, OUT_OF_STOCK, RETIRED } from "../../../constants/product-status";
import ContextMenuResource from "../../../components/common/ContextMenu/ContextMenuResource";

export type ProductCardState = "ready" | "loading" | "fetching" | "failed";

/** The picture a list shows: the main image, else the first. */
export function mainImageOf(product: Product | undefined): string | undefined {
  const images = product?.images ?? [];
  const main = typeof product?.mainImageIndex === "number" ? images[product.mainImageIndex] : undefined;
  return main || images[0] || undefined;
}

export type ProductCardLayout = "tile" | "row";

const cardSx = (layout: ProductCardLayout) =>
  ({
    height: "100%",
    display: "grid",
    ...(layout === "tile" ? { gridTemplateRows: "auto 1fr" } : { gridTemplateColumns: "104px minmax(0, 1fr)" }),
    border: 1,
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
    overflow: "hidden",
    transition: "border-color 150ms ease",
    "&:hover": { borderColor: "action.disabled" },
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  }) as const;

const pictureSx = (layout: ProductCardLayout) =>
  ({
    position: "relative",
    display: "block",
    aspectRatio: "1 / 1",
    bgcolor: "action.hover",
    color: "text.secondary",
    ...(layout === "row" && { width: 104, height: 104, alignSelf: "start", m: 1, mr: 0, borderRadius: 1.5, overflow: "hidden" }),
  }) as const;

const bodySx = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  p: 1.5,
  minWidth: 0,
} as const;

/** A row's body: its details, with the button under them on phones and beside them on wider screens. */
const rowBodySx = {
  ...bodySx,
  flexDirection: { xs: "column", sm: "row" },
  alignItems: { xs: "stretch", sm: "center" },
  gap: { xs: 1, sm: 2 },
} as const;

export function ProductCardSkeleton({ note, layout = "tile" }: { note?: string; layout?: ProductCardLayout }) {
  return (
    <Box sx={cardSx(layout)} aria-hidden={note ? undefined : true}>
      <Box sx={pictureSx(layout)}>
        <Skeleton variant="rectangular" sx={{ width: "100%", height: "100%" }} />
      </Box>
      <Box sx={bodySx}>
        <Skeleton width="85%" />
        <Skeleton width="45%" />
        {note ? (
          <Typography variant="body2" color="text.secondary" role="status">
            {note}
          </Typography>
        ) : (
          <Skeleton variant="rounded" height={40} />
        )}
      </Box>
    </Box>
  );
}

export function ProductCard({
  product,
  productId,
  catalogueId,
  owner,
  storeId,
  status,
  shop,
  coin,
  rate,
  isOwnProduct,
  onAddToCart,
  layout = "tile",
  compact = false,
}: {
  product: Product;
  productId: string;
  catalogueId: string;
  owner: string;
  storeId: string;
  /** The catalogue's status, else the index's. */
  status: string | undefined;
  shop: ShopCoinSettings | null | undefined;
  coin: string;
  rate: number | null;
  isOwnProduct: boolean;
  onAddToCart: () => void;
  layout?: ProductCardLayout;
  /** A narrow tile (two side by side on a phone): the button drops its icon so its text fits. */
  compact?: boolean;
}) {
  const title = product.title?.trim() || "Untitled product";
  const image = mainImageOf(product);
  const path = productPath(owner, storeId, productId, catalogueId);
  const available = status === AVAILABLE;
  const label = isOwnProduct ? "Your product" : status === OUT_OF_STOCK ? "Out of stock" : status === RETIRED ? "Retired" : "Add to cart";

  return (
    <ContextMenuResource link={productLink(owner, storeId, productId, catalogueId)}>
      <Box component="article" sx={cardSx(layout)}>
        <Link component={RouterLink} to={path} tabIndex={-1} aria-hidden sx={pictureSx(layout)}>
          {image ? (
            <Box
              component="img"
              src={image}
              alt={title}
              loading="lazy"
              decoding="async"
              sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
              <ImageOutlinedIcon fontSize="large" />
            </Box>
          )}
        </Link>
        <Box sx={layout === "row" ? rowBodySx : bodySx}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: layout === "row" ? 1 : undefined }}>
            <Typography component="h3" sx={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35 }}>
              <Link
                component={RouterLink}
                to={path}
                underline="hover"
                color="inherit"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  overflowWrap: "anywhere",
                  // Tiles keep two lines for the title, so a row of tiles lines up.
                  minHeight: layout === "tile" ? "2.7em" : undefined,
                }}
              >
                {title}
              </Link>
            </Typography>
            {layout === "row" && typeof product.description === "string" && product.description.trim() && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: { xs: "none", sm: "-webkit-box" },
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  overflowWrap: "anywhere",
                }}
              >
                {product.description.trim()}
              </Typography>
            )}
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <PriceTag product={product} coin={coin} rate={rate} shop={shop} />
              {status === OUT_OF_STOCK && <Chip size="small" label="Out of stock" variant="outlined" />}
              {status === RETIRED && <Chip size="small" label="Retired" variant="outlined" />}
          </Box>
          </Box>
          <Button
            variant={available && !isOwnProduct ? "contained" : "outlined"}
            startIcon={available && !isOwnProduct && !compact ? <AddShoppingCartOutlinedIcon /> : undefined}
            disabled={!available || isOwnProduct}
            onClick={onAddToCart}
            aria-label={available && !isOwnProduct ? `Add to cart: ${title}` : undefined}
            sx={{
              mt: layout === "row" ? 0 : "auto",
              minHeight: 44,
              flexShrink: 0,
              whiteSpace: "nowrap",
              ...(compact && { px: 1 }),
              alignSelf: layout === "row" ? { xs: "stretch", sm: "center" } : "stretch",
            }}
          >
            {label}
          </Button>
        </Box>
      </Box>
    </ContextMenuResource>
  );
}
