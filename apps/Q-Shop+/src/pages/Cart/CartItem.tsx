import type { ReactNode } from "react";
import { Box, Button, IconButton, Link, Skeleton, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { PriceTag } from "../../components/money/PriceTag";
import { unitPrice } from "../../money/pricing";
import { coinLabel, type ShopCoinSettings } from "../../money/coins";
import { productPath } from "../../qdn/links";
import { QuantityStepper } from "./QuantityStepper";
import { Picture } from "./Picture";
import type { CartViewLine } from "./cartLines";

const THUMB = 72;

/** Why a line can't be bought: plain text (4.5:1 in every theme) with a warning mark. */
function LineNote({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" sx={{ mt: 0.5, display: "flex", alignItems: "flex-start", gap: 0.5, fontWeight: 600 }}>
      <ReportProblemOutlinedIcon color="warning" sx={{ fontSize: 18, mt: "1px" }} aria-hidden />
      <span>{children}</span>
    </Typography>
  );
}

const ROW_SX = {
  display: "grid",
  gridTemplateColumns: `${THUMB}px minmax(0, 1fr)`,
  gap: 1.5,
  py: 1.5,
  borderTop: 1,
  borderColor: "divider",
  listStyle: "none",
} as const;

/** The list's width (a container query: it is narrower beside the summary) from which a line is one row. */
const WIDE = "@container (min-width: 640px)";

/**
 * A line: the picture beside the title (Remove at its end), with the stepper
 * and the line's total under both, across the line, the total on its own
 * line when it is too long for both ("112,800.00 BHC Coin": Simon's phone,
 * 2026-10-27, where a total column as wide as the amount squeezed the title
 * to a sliver); all in one row once the shop's list is 640 px wide.
 */
const LINE_SX = {
  ...ROW_SX,
  gridTemplateColumns: `${THUMB}px minmax(0, 1fr) auto`,
  gridTemplateAreas: `"thumb info remove" "foot foot foot"`,
  columnGap: 1.5,
  rowGap: 1,
  alignItems: "start",
  [WIDE]: {
    gridTemplateColumns: `${THUMB}px minmax(0, 1fr) auto minmax(96px, auto) auto`,
    gridTemplateAreas: `"thumb info qty total remove"`,
    columnGap: 2,
    alignItems: "center",
  },
} as const;

/** The stepper and the total: wrapping side by side under the title, or (one row) each in its own column. */
const FOOT_SX = {
  gridArea: "foot",
  minWidth: 0,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  columnGap: 1.5,
  rowGap: 0.5,
  [WIDE]: { display: "contents" },
} as const;

/** A line while its catalogue loads: shaped like the real row. */
export function CartItemSkeleton({ fetching }: { fetching?: boolean }) {
  return (
    <Box component="li" sx={ROW_SX} aria-busy="true">
      <Skeleton variant="rounded" width={THUMB} height={THUMB} />
      <Box>
        <Skeleton width="60%" />
        <Skeleton width="30%" />
        {fetching ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Fetching from peers…
          </Typography>
        ) : (
          <Skeleton variant="rounded" width={132} height={44} sx={{ mt: 1, borderRadius: 999 }} />
        )}
      </Box>
    </Box>
  );
}

/**
 * One line of a shop's cart: picture, title (to the product page), price
 * each in the shop's coin, a quantity stepper, the line total and Remove.
 * Lines that can't be bought say why and offer Remove (or Retry).
 */
export function CartItem({
  line,
  owner,
  storeId,
  coin,
  rate,
  rateLoading,
  rateError = false,
  shop,
  onQuantity,
  onRemove,
  onRetry,
  quiet = false,
}: {
  line: CartViewLine;
  owner: string;
  storeId: string;
  coin: string;
  rate: number | null;
  /** The coin's rate is on its way, so converted prices aren't known yet. */
  rateLoading: boolean;
  /** The node has no rate for the coin: only the seller's own prices in it are known. */
  rateError?: boolean;
  shop: ShopCoinSettings | null;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onRetry: () => void;
  /** Its shop was deleted: the shop's own note says so, once, so the line has none. */
  quiet?: boolean;
}) {
  if (line.state === "loading" || line.state === "fetching") {
    return <CartItemSkeleton fetching={line.state === "fetching"} />;
  }
  const product = line.product;
  const title = product?.title || "An item from this shop";
  const images = product?.images ?? [];
  const image = images[product?.mainImageIndex ?? 0] ?? images[0];
  const forSale = line.state === "ready";
  const unit = forSale ? unitPrice(product, coin, rate) : undefined;

  return (
    <Box component="li" sx={LINE_SX}>
      <Box sx={{ gridArea: "thumb" }}>
        <Picture src={image} alt={product?.title ?? ""} size={THUMB} fallback={<ImageOutlinedIcon aria-hidden />} />
      </Box>
      <Box sx={{ gridArea: "info", minWidth: 0, pt: 0.25 }}>
        {product ? (
          <Link
            component={RouterLink}
            to={productPath(owner, storeId, line.productId, line.catalogueId)}
            underline="hover"
            color="text.primary"
            sx={{
              fontWeight: 600,
              fontSize: 16,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </Link>
        ) : (
          <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{title}</Typography>
        )}

        {forSale && (
          <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            {unit === undefined ? (
              rateLoading ? (
                "Getting the price…"
              ) : rateError ? (
                `No ${coin} rate on your node right now`
              ) : (
                `No price in ${coinLabel(coin, shop)}`
              )
            ) : (
              <>
                <PriceTag product={product} coin={coin} rate={rate} shop={shop} size="small" sx={{ fontWeight: 500 }} /> each
              </>
            )}
          </Typography>
        )}

        {line.state === "unavailable" && (
          <LineNote>{line.soldOut ? "Sold out" : product?.status === "OUT_OF_STOCK" ? "Out of stock" : "No longer sold"}: left out of checkout</LineNote>
        )}
        {forSale && line.stockLeft !== undefined && line.quantity > line.stockLeft && (
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <LineNote>{`Only ${line.stockLeft} left`}</LineNote>
            <Button size="small" variant="outlined" color="inherit" onClick={() => onQuantity(line.stockLeft as number)} sx={{ minHeight: 44 }}>
              {`Change to ${line.stockLeft}`}
            </Button>
          </Box>
        )}
        {line.state === "gone" && !quiet && <LineNote>The seller removed this product: left out of checkout</LineNote>}
        {line.state === "failed" && <LineNote>Not available on your node right now: left out of checkout</LineNote>}
      </Box>

      <Box sx={FOOT_SX}>
        <Box sx={{ gridArea: "qty", display: "flex", alignItems: "center" }}>
          {forSale ? (
            <QuantityStepper quantity={line.quantity} onChange={onQuantity} itemName={title} />
          ) : line.state === "failed" ? (
            <Button variant="outlined" onClick={onRetry} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Quantity {line.quantity}
            </Typography>
          )}
        </Box>
        <Box sx={{ gridArea: "total", display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: 44, minWidth: 0, ml: "auto" }}>
          {forSale && unit !== undefined && (
            <PriceTag product={product} coin={coin} rate={rate} quantity={line.quantity} shop={shop} size="medium" sx={{ fontSize: 16 }} />
          )}
        </Box>
      </Box>
      <IconButton
        aria-label={`Remove ${title}`}
        onClick={onRemove}
        sx={{ gridArea: "remove", justifySelf: "end", width: 44, height: 44, mt: -0.75, mr: -1, [WIDE]: { mt: 0, mr: 0 } }}
      >
        <DeleteOutlineIcon />
      </IconButton>
    </Box>
  );
}
