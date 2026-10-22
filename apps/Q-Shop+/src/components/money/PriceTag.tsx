import { Box, Typography, type TypographyProps } from "@mui/material";
import { CoinIcon } from "./CoinIcon";
import { coinLabel, type ShopCoinSettings } from "../../money/coins";
import { formatPrice, unitPrice, type PricedProduct } from "../../money/pricing";

/**
 * A product's price in a coin, with the coin's mark and name, computed with
 * the same rules as checkout (money/pricing.ts). Shows "—" while a converted
 * price waits for its rate, never a QORT number labelled as another coin.
 */
export function PriceTag({
  product,
  coin,
  rate,
  quantity = 1,
  shop,
  size = "medium",
  variant,
  sx,
}: {
  product: PricedProduct | null | undefined;
  coin: string;
  rate: number | null;
  quantity?: number;
  shop?: ShopCoinSettings | null;
  size?: "small" | "medium" | "large";
  variant?: TypographyProps["variant"];
  sx?: TypographyProps["sx"];
}) {
  const unit = unitPrice(product, coin, rate);
  const value = unit === undefined ? undefined : unit * quantity;
  return <AmountTag value={value} coin={coin} shop={shop} size={size} variant={variant} sx={sx} />;
}

/** An amount in a coin (already computed), e.g. an order total. */
export function AmountTag({
  value,
  coin,
  shop,
  size = "medium",
  variant,
  sx,
}: {
  value: number | string | undefined | null;
  coin: string;
  shop?: ShopCoinSettings | null;
  size?: "small" | "medium" | "large";
  variant?: TypographyProps["variant"];
  sx?: TypographyProps["sx"];
}) {
  const label = coinLabel(coin, shop);
  const icon = size === "large" ? 24 : size === "small" ? 14 : 18;
  const numeric = typeof value === "string" ? Number(value) : value;
  const text = formatPrice(numeric ?? undefined);
  return (
    <Typography
      component="span"
      variant={variant ?? (size === "large" ? "h5" : size === "small" ? "body2" : "body1")}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, fontWeight: 700, fontVariantNumeric: "tabular-nums", ...((sx as object) ?? {}) }}
    >
      <CoinIcon coin={coin} size={icon} label={label} />
      <Box component="span">
        {text}
        {text !== "—" && (
          <Box component="span" sx={{ fontWeight: 500, color: "text.secondary", ml: 0.5, fontSize: "0.85em" }}>
            {label}
          </Box>
        )}
      </Box>
    </Typography>
  );
}
