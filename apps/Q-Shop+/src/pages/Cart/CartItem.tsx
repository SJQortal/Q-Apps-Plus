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

function Thumb({ src, alt }: { src?: string; alt: string }) {
  return (
    <Box
      sx={{
        width: THUMB,
        height: THUMB,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "action.hover",
        color: "text.secondary",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {src ? (
        <Box component="img" src={src} alt={alt} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <ImageOutlinedIcon aria-hidden />
      )}
    </Box>
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
  shop,
  onQuantity,
  onRemove,
  onRetry,
}: {
  line: CartViewLine;
  owner: string;
  storeId: string;
  coin: string;
  rate: number | null;
  /** The coin's rate is on its way, so converted prices aren't known yet. */
  rateLoading: boolean;
  shop: ShopCoinSettings | null;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onRetry: () => void;
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
  const removeButton = (
    <IconButton aria-label={`Remove ${title}`} onClick={onRemove} sx={{ width: 44, height: 44 }}>
      <DeleteOutlineIcon />
    </IconButton>
  );

  return (
    <Box component="li" sx={ROW_SX}>
      <Thumb src={image} alt={product?.title ?? ""} />
      <Box sx={{ minWidth: 0 }}>
        {product ? (
          <Link
            component={RouterLink}
            to={productPath(owner, storeId, line.productId, line.catalogueId)}
            underline="hover"
            color="text.primary"
            sx={{
              fontWeight: 600,
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
          <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
        )}

        {forSale && (
          <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            {unit === undefined ? (
              rateLoading ? (
                "Getting the price…"
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
          <LineNote>{product?.status === "OUT_OF_STOCK" ? "Out of stock" : "No longer sold"}: left out of checkout</LineNote>
        )}
        {line.state === "gone" && <LineNote>The seller removed this product: left out of checkout</LineNote>}
        {line.state === "failed" && <LineNote>Not available on your node right now: left out of checkout</LineNote>}

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mt: 1 }}>
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
            {forSale && unit !== undefined && (
              <PriceTag product={product} coin={coin} rate={rate} quantity={line.quantity} shop={shop} size="medium" />
            )}
            {removeButton}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
