import { useId } from "react";
import { CartDelivery } from "./CartDelivery";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Link, Paper, Skeleton, Typography } from "@mui/material";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { AmountTag } from "../../components/money/PriceTag";
import { useShopCoin } from "../../money/useShopCoin";
import { coinLabel } from "../../money/coins";
import { noRateText } from "../../money/coinRate";
import type { CartLine } from "../../money/order";
import { storePath } from "../../qdn/links";
import { shortStoreIdOf } from "../../qdn/identifiers";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { CartItem } from "./CartItem";
import { CoinPicker } from "./CoinPicker";
import { Picture } from "./Picture";
import { checkoutBlock, checkoutLinesOf, isLeftOut, priceLines, withLineStock, type CartViewLine } from "./cartLines";
import { stockOf } from "../../stock/model";
import { useStockLeft } from "../../stock/notes";
import type { ShopCartView } from "./useCartData";
import { FreeDeliveryBar } from "../../delivery/FreeDeliveryBar";

export interface CheckoutGate {
  allowed: boolean;
  /** Why checkout isn't possible (signed out, no name). */
  reason?: string;
}

function ShopLogo({ src, title }: { src?: string; title: string }) {
  return <Picture src={src} alt={`${title} logo`} size={44} fit="contain" fallback={<StorefrontOutlinedIcon aria-hidden />} />;
}

/**
 * One shop's cart on the cart page: the shop, its lines, the coin to pay
 * with, the subtotal, and Check out. Lines that can't be bought are flagged
 * and left out of checkout. A shop its owner deleted shows plainly: its
 * name, the items, and Remove items, with nothing to check out.
 */
export function ShopCart({
  view,
  gate,
  onCheckout,
  onQuantity,
  onRemove,
  onRemoveShop,
  onRetryShop,
  onRetryLines,
}: {
  view: ShopCartView;
  gate: CheckoutGate;
  onCheckout: (view: ShopCartView, lines: CartLine[], leftOut: number) => void;
  onQuantity: (view: ShopCartView, line: CartViewLine, quantity: number) => void;
  onRemove: (view: ShopCartView, line: CartViewLine) => void;
  /** Empties this shop's cart (offered when its owner deleted the shop). */
  onRemoveShop?: (view: ShopCartView) => void;
  onRetryShop: (view: ShopCartView) => void;
  onRetryLines: (view: ShopCartView) => void;
}) {
  const headingId = useId();
  const { coins, coin, rate, rateLoading, rateError, setCoin } = useShopCoin(view.shop);
  const { shop, owner, storeId } = view;
  const gone = view.shopPhase === "gone";
  const title = shop?.title || view.knownTitle || (gone ? shortStoreIdOf(storeId) : "") || "Shop";
  // Counted products (stock/model.ts): what's left of each, from the shop's order notes.
  const stockItems = view.lines.flatMap((line) => {
    const stock = line.state === "ready" ? stockOf(line.product) : null;
    return stock ? [{ shortStoreId: shortStoreIdOf(storeId), productId: line.productId, stock }] : [];
  });
  const { left: stockLeft } = useStockLeft(stockItems);
  const viewLines = withLineStock(view.lines, stockLeft);
  const lines = checkoutLinesOf(viewLines);
  const leftOut = viewLines.filter(isLeftOut).length;
  const counted = lines.filter((line) => stockOf(line.product));
  const priced = priceLines(lines, coin, rate, rateLoading, rateError);

  const blocked = checkoutBlock({ ...view, lines: viewLines }, gate.allowed ? undefined : (gate.reason ?? "Sign in to check out."));

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 2, mb: 2, [`@media ${PHONE_MEDIA}`]: { p: 1.5 } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        {shop || view.knownTitle || gone ? (
          <ShopLogo src={shop?.logo} title={title} />
        ) : (
          <Skeleton variant="rounded" width={44} height={44} />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography id={headingId} component="h2" sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
            {owner && storeId && !gone ? (
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
      {!shop && view.shopPhase === "gone" && (
        <Alert
          severity="info"
          sx={{ mt: 1 }}
          action={
            onRemoveShop ? (
              <Button color="inherit" onClick={() => onRemoveShop(view)} sx={{ minHeight: 44 }}>
                Remove items
              </Button>
            ) : undefined
          }
        >
          Its owner deleted this shop, so these items can&apos;t be bought.
        </Alert>
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

      {/* Its lines lay out by the list's own width (CartItem.tsx). */}
      <Box component="ul" sx={{ m: 0, p: 0, containerType: "inline-size" }} aria-label={`Items from ${title}`}>
        {viewLines.map((line) => (
          <CartItem
            key={line.productId}
            quiet={gone}
            line={line}
            owner={owner ?? ""}
            storeId={storeId}
            coin={coin}
            rate={rate}
            rateLoading={rateLoading}
            rateError={rateError}
            shop={shop}
            onQuantity={(quantity) => onQuantity(view, line, quantity)}
            onRemove={() => onRemove(view, line)}
            onRetry={() => onRetryLines(view)}
          />
        ))}
      </Box>

      {!gone && (
        <Box
          sx={{
            borderTop: 1,
            borderColor: "divider",
            pt: 2,
            display: "grid",
            gap: 1.5,
            // From 600 px: the coin and notes on the left, the subtotal and Check out on the right.
            gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) auto" },
            alignItems: "end",
          }}
        >
          <Box sx={{ display: "grid", gap: 1, minWidth: 0 }}>
            {shop && <CoinPicker coins={coins} value={coin} onChange={setCoin} shop={shop} />}
            {/* What delivery adds, before checkout (Cart/CartDelivery.tsx). */}
            {shop && owner && <CartDelivery owner={owner} storeId={storeId} shop={shop} lines={lines} />}
            {/* How much more for free delivery, when the shop's prices there have it (delivery/FreeDeliveryBar.tsx). */}
            {shop && owner && <FreeDeliveryBar owner={owner} storeId={storeId} lines={lines} />}
            {!priced.ok && priced.reason === "price" && priced.missing.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {priced.missing.join(", ")} {priced.missing.length === 1 ? "has" : "have"} no price in {coinLabel(coin, shop)}.
              </Typography>
            )}
            {!priced.ok && priced.reason === "no-rate" && (
              <Typography variant="body2" color="text.secondary">
                {noRateText(coin, coinLabel(coin, shop))}, so {priced.missing.join(", ")} can&apos;t be paid in {coinLabel(coin, shop)}. Pick
                another coin, or remove {priced.missing.length === 1 ? "it" : "them"} to pay in {coinLabel(coin, shop)}.
              </Typography>
            )}
            {leftOut > 0 && (
              <Typography variant="body2" color="text.secondary">
                {leftOut === 1 ? "1 item can't be bought now and is" : `${leftOut} items can't be bought now and are`} left out of checkout.
              </Typography>
            )}
            {counted.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                This shop counts its stock: your order shows publicly how many of{" "}
                {counted.map((line) => line.product?.title?.trim() || "an item").join(", ")} you bought (not your address or what you paid), so
                every buyer sees what&apos;s left.
              </Typography>
            )}
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "stretch", sm: "flex-end" }, gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Subtotal</Typography>
              {priced.ok ? (
                <AmountTag value={priced.amount} coin={coin} shop={shop} size="large" sx={{ fontSize: 20 }} />
              ) : (
                <Typography color="text.secondary">—</Typography>
              )}
            </Box>
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
              <Typography id={`${headingId}-why`} variant="body2" color="text.secondary" sx={{ textAlign: { sm: "right" } }}>
                {blocked}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
