/**
 * A product on the shop page: picture, title, price in the shop's chosen coin
 * (money/ computes it, exactly as checkout will), stock, and Add to cart; for
 * an auction, its starting bid in QORT, the time left and Bid (its page).
 * A tile (picture on top) or a row (picture on the left, and on wider
 * screens the start of the description), as the buyer's product view says
 * (utils/productView.ts). Right-click copies the product's link.
 */
import { Box, Button, Chip, Link, Skeleton, Typography } from "@mui/material";
import { visuallyHiddenSx } from "../a11y";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { Link as RouterLink } from "react-router-dom";
import type { Product } from "../../../state/features/storeSlice";
import type { ShopCoinSettings } from "../../../money/coins";
import { PriceTag } from "../../../components/money/PriceTag";
import { productLink, productPath, storePath } from "../../../qdn/links";
import { AVAILABLE, OUT_OF_STOCK, RETIRED } from "../../../constants/product-status";
import ContextMenuResource from "../../../components/common/ContextMenu/ContextMenuResource";
import { useLoadedPictures } from "../../../components/common/useLoadedPictures";
import { ProductImage } from "../../../components/common/ProductImage";
import { scheduledPhase, timeLeft, type AuctionPhase } from "../../../auctions/rules";
import type { AuctionRow } from "../../../auctions/catalog";

export type ProductCardState = "ready" | "loading" | "fetching" | "failed";

/** The picture a list shows: the main image, else the first. */
export function mainImageOf(product: Product | undefined): string | undefined {
  const images = product?.images ?? [];
  const main = typeof product?.mainImageIndex === "number" ? images[product.mainImageIndex] : undefined;
  return main || images[0] || undefined;
}

export type ProductCardLayout = "tile" | "row";

/** An auction's line on a card: "Ends in 2d 4h", by its times. */
export function auctionCardText(times: AuctionRow, now: number): { phase: AuctionPhase; text: string } {
  const phase = scheduledPhase(times, now);
  if (phase === "upcoming") return { phase, text: `Starts in ${timeLeft(times.start - now)}` };
  if (phase === "live") return { phase, text: `Ends in ${timeLeft(times.end - now)}` };
  return { phase, text: "Auction ended" };
}

const cardSx = (layout: ProductCardLayout) =>
  ({
    height: "100%",
    display: "grid",
    // A row's column is the 104 px picture and its 8 px margin.
    ...(layout === "tile" ? { gridTemplateRows: "auto 1fr" } : { gridTemplateColumns: "112px minmax(0, 1fr)" }),
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

/** A row's body on wider screens: its details, with the button beside them. */
const rowBodySx = {
  ...bodySx,
  flexDirection: "row",
  alignItems: "center",
  gap: 2,
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
  stacked = false,
  shopName,
  auction = null,
  now = 0,
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
  /** A row on a phone (held either way): the button goes under the details, which keep the width. */
  stacked?: boolean;
  /** Lists of several shops' products (the Products page): the shop's name under the title, linked to the shop. */
  shopName?: string;
  /** When it sells by auction: when it runs (the list's `now` says where it stands). */
  auction?: AuctionRow | null;
  now?: number;
}) {
  const title = product.title?.trim() || "Untitled product";
  const image = mainImageOf(product);
  const path = productPath(owner, storeId, productId, catalogueId);
  const available = status === AVAILABLE;
  const label = isOwnProduct ? "Your product" : status === OUT_OF_STOCK ? "Out of stock" : status === RETIRED ? "Retired" : "Add to cart";
  const pictures = useLoadedPictures();
  // An auction is stored out of stock, for the original app: its card says where the auction stands instead.
  const auctionLine = auction && status !== RETIRED ? auctionCardText(auction, now) : null;
  const shopLabel = shopName !== undefined ? ` (${shopName.trim() || owner})` : "";
  const buttonSx = {
    mt: layout === "row" && !stacked ? 0 : "auto",
    minHeight: 44,
    flexShrink: 0,
    whiteSpace: "nowrap",
    ...(compact && { px: 1 }),
    alignSelf: layout === "row" && !stacked ? "center" : "stretch",
  } as const;

  return (
    <ContextMenuResource link={productLink(owner, storeId, productId, catalogueId)}>
      <Box component="article" sx={cardSx(layout)}>
        {/* Once the picture is in, no backdrop: a transparent background shows the card. */}
        <Link component={RouterLink} to={path} tabIndex={-1} aria-hidden sx={[pictureSx(layout), pictures.isLoaded(image) && { bgcolor: "transparent" }]}>
          {image ? (
            <ProductImage src={image} alt={title} loading="lazy" onLoad={pictures.onLoad(image)} />
          ) : (
            <Box sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center" }}>
              <ImageOutlinedIcon fontSize="large" />
            </Box>
          )}
        </Link>
        <Box sx={layout === "row" && !stacked ? rowBodySx : bodySx}>
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
            {shopName !== undefined && (
              <Link
                component={RouterLink}
                to={storePath(owner, storeId)}
                underline="hover"
                color="text.secondary"
                sx={{ fontSize: 14, mt: -0.5, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                <Box component="span" sx={visuallyHiddenSx}>
                  Shop:
                </Box>{" "}
                {shopName.trim() || owner}
              </Link>
            )}
            {layout === "row" && typeof product.description === "string" && product.description.trim() && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: 14,
                  display: stacked ? "none" : "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  overflowWrap: "anywhere",
                }}
              >
                {product.description.trim()}
              </Typography>
            )}
            {auctionLine ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                  {/* Bids are in QORT, whatever coin the shop's prices show in. */}
                  <PriceTag product={product} coin="QORT" rate={null} shop={shop} />
                  <Chip size="small" icon={<GavelOutlinedIcon />} label="Auction" variant="outlined" sx={{ fontWeight: 600 }} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  {auctionLine.phase === "ended" ? auctionLine.text : `Starting bid · ${auctionLine.text}`}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <PriceTag product={product} coin={coin} rate={rate} shop={shop} />
                {status === OUT_OF_STOCK && <Chip size="small" label="Out of stock" variant="outlined" />}
                {status === RETIRED && <Chip size="small" label="Retired" variant="outlined" />}
              </Box>
            )}
          </Box>
          {auctionLine && !isOwnProduct ? (
            <Button
              component={RouterLink}
              to={path}
              variant={auctionLine.phase === "live" ? "contained" : "outlined"}
              color={auctionLine.phase === "live" ? "primary" : "inherit"}
              startIcon={auctionLine.phase === "live" && !compact ? <GavelOutlinedIcon /> : undefined}
              aria-label={`${auctionLine.phase === "live" ? "Bid" : auctionLine.phase === "upcoming" ? "View auction" : "See result"}: ${title}${shopLabel}`}
              sx={buttonSx}
            >
              {auctionLine.phase === "live" ? "Bid" : auctionLine.phase === "upcoming" ? "View auction" : "See result"}
            </Button>
          ) : (
            <Button
              variant={available && !isOwnProduct ? "contained" : "outlined"}
              startIcon={available && !isOwnProduct && !compact ? <AddShoppingCartOutlinedIcon /> : undefined}
              disabled={!available || isOwnProduct}
              onClick={onAddToCart}
              // Several shops' lists can hold two products of one name: the shop tells them apart.
              aria-label={available && !isOwnProduct ? `Add to cart: ${title}${shopLabel}` : undefined}
              sx={buttonSx}
            >
              {auctionLine && isOwnProduct ? "Your auction" : label}
            </Button>
          )}
        </Box>
      </Box>
    </ContextMenuResource>
  );
}
