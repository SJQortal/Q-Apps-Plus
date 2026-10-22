import { useId } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Link, Paper, Skeleton, Typography } from "@mui/material";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { AmountTag } from "../../components/money/PriceTag";
import { useShopCoin } from "../../money/useShopCoin";
import { coinLabel } from "../../money/coins";
import type { CartLine } from "../../money/order";
import { storePath } from "../../qdn/links";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { CartItem } from "./CartItem";
import { CoinPicker } from "./CoinPicker";
import { Picture } from "./Picture";
import { checkoutLinesOf, isLeftOut, isLoadingLine, priceLines, type CartViewLine } from "./cartLines";
import type { ShopCartView } from "./useCartData";

export interface CheckoutGate {
  allowed: boolean;
  /** Why checkout isn't possible (signed out, no name). */
  reason?: string;
}

function ShopLogo({ src, title }: { src?: string; title: string }) {
  return <Picture src={src} alt={`${title} logo`} size={44} fallback={<StorefrontOutlinedIcon aria-hidden />} />;
}

/**
 * One shop's cart on the cart page: the shop, its lines, the coin to pay
 * with, the subtotal, and Check out. Lines that can't be bought are flagged
 * and left out of checkout.
 */
export function ShopCart({
  view,
  gate,
  onCheckout,
  onQuantity,
  onRemove,
  onRetryShop,
  onRetryLines,
}: {
  view: ShopCartView;
  gate: CheckoutGate;
  onCheckout: (view: ShopCartView, lines: CartLine[], leftOut: number) => void;
  onQuantity: (view: ShopCartView, line: CartViewLine, quantity: number) => void;
  onRemove: (view: ShopCartView, line: CartViewLine) => void;
  onRetryShop: (view: ShopCartView) => void;
  onRetryLines: (view: ShopCartView) => void;
}) {
  const headingId = useId();
  const { coins, coin, rate, rateLoading, setCoin } = useShopCoin(view.shop);
  const { shop, owner, storeId } = view;
  const title = shop?.title || view.knownTitle || "Shop";
  const lines = checkoutLinesOf(view.lines);
  const leftOut = view.lines.filter(isLeftOut).length;
  const loading = view.lines.some(isLoadingLine);
  const priced = priceLines(lines, coin, rate, rateLoading);

  const blocked = !gate.allowed
    ? gate.reason
    : !shop
      ? view.shopPhase === "failed"
        ? "This shop couldn't be loaded."
        : "Waiting for the shop to load…"
      : loading
        ? "Loading your items…"
        : lines.length === 0
          ? "Nothing here can be bought right now."
          : undefined;

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2, mb: 2, [`@media ${PHONE_MEDIA}`]: { p: 1.5 } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        {shop || view.knownTitle ? (
          <ShopLogo src={shop?.logo} title={title} />
        ) : (
          <Skeleton variant="rounded" width={44} height={44} />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id={headingId} component="h2" sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
            {owner && storeId ? (
              <Link component={RouterLink} to={storePath(owner, storeId)} underline="hover" color="text.primary" sx={{ overflowWrap: "anywhere" }}>
                {shop || view.knownTitle ? title : <Skeleton width={160} />}
              </Link>
            ) : (
              title
            )}
          </Typography>
          {owner && (
            <Typography variant="body2" color="text.secondary" noWrap>
              by {owner}
            </Typography>
          )}
        </Box>
      </Box>

      {!shop && view.shopPhase === "retrying" && (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Fetching the shop from peers…
        </Typography>
      )}
      {!shop && view.shopPhase === "failed" && (
        <Alert
          severity="warning"
          sx={{ mt: 1 }}
          action={
            owner ? (
              <Button color="inherit" onClick={() => onRetryShop(view)} sx={{ minHeight: 44 }}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {owner ? "This shop isn't available on your node right now." : "This cart doesn't say whose shop it is. Remove its items."}
        </Alert>
      )}

      <Box component="ul" sx={{ m: 0, p: 0 }} aria-label={`Items from ${title}`}>
        {view.lines.map((line) => (
          <CartItem
            key={line.productId}
            line={line}
            owner={owner ?? ""}
            storeId={storeId}
            coin={coin}
            rate={rate}
            rateLoading={rateLoading}
            shop={shop}
            onQuantity={(quantity) => onQuantity(view, line, quantity)}
            onRemove={() => onRemove(view, line)}
            onRetry={() => onRetryLines(view)}
          />
        ))}
      </Box>

      <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2, display: "grid", gap: 1.5 }}>
        {shop && <CoinPicker coins={coins} value={coin} onChange={setCoin} shop={shop} />}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Subtotal</Typography>
          {priced.ok ? (
            <AmountTag value={priced.amount} coin={coin} shop={shop} size="large" sx={{ fontSize: 20 }} />
          ) : (
            <Typography color="text.secondary">—</Typography>
          )}
        </Box>
        {!priced.ok && priced.reason === "price" && priced.missing.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {priced.missing.join(", ")} {priced.missing.length === 1 ? "has" : "have"} no price in {coinLabel(coin, shop)}.
          </Typography>
        )}
        {leftOut > 0 && (
          <Typography variant="body2" color="text.secondary">
            {leftOut === 1 ? "1 item can't be bought now and is" : `${leftOut} items can't be bought now and are`} left out of checkout.
          </Typography>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "stretch", sm: "flex-end" }, gap: 0.75 }}>
          <Button
            variant="contained"
            size="large"
            onClick={() => onCheckout(view, lines, leftOut)}
            disabled={blocked !== undefined}
            aria-describedby={blocked ? `${headingId}-why` : undefined}
            aria-label={`Check out ${title}`}
            sx={{ minHeight: 48, minWidth: { sm: 200 } }}
          >
            Check out
          </Button>
          {blocked && (
            <Typography id={`${headingId}-why`} variant="body2" color="text.secondary">
              {blocked}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
