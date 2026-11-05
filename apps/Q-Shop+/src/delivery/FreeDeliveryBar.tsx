/**
 * "Add 40.00 USD more for free delivery to Iceland" with a bar filling up,
 * or "Free delivery to Iceland" once there (delivery/freeDelivery.ts): in a
 * shop's cart, at checkout and on the shop's page, for the buyer's country
 * (delivery/buyerPlace.ts). Nothing without a country, or for a shop whose
 * prices there aren't free from an amount.
 */
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { Box, LinearProgress, Typography } from "@mui/material";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import type { RootState } from "../state/store";
import type { CartLine } from "../money/order";
import { formatPrice } from "../money/pricing";
import { statusText } from "../theme/statusText";
import { useShopDelivery } from "./useShopDelivery";
import { useBuyerPlace } from "./buyerPlace";
import { freeDeliveryProgress } from "./freeDelivery";
import { deliveryMoney } from "./model";
import { cartKeyOf } from "../state/features/cartSlice";

/** What's in the buyer's cart for this shop, with the products the page has read (the shop page's bar). */
export function useShopCartLines(owner: string, storeId: string): CartLine[] {
  const carts = useSelector((state: RootState) => state.cart.carts);
  const catalogues = useSelector((state: RootState) => state.global.catalogueHashMap);
  return useMemo(() => {
    const key = cartKeyOf(carts, owner, storeId);
    if (!key) return [];
    return Object.values(carts[key].orders).flatMap((order) => {
      const product = catalogues[order.catalogueId]?.products?.[order.productId];
      return product ? [{ productId: order.productId, catalogueId: order.catalogueId, quantity: order.quantity, product: product as CartLine["product"] }] : [];
    });
  }, [carts, catalogues, owner, storeId]);
}

export function FreeDeliveryBar({ owner, storeId, lines, framed = false }: { owner: string; storeId: string; lines: readonly CartLine[]; framed?: boolean }) {
  const buyer = useSelector((state: RootState) => state.auth.user?.name);
  const place = useBuyerPlace(buyer);
  const load = useShopDelivery(owner, storeId, !!place);
  if (!place || load.status !== "ready" || !load.delivery.doc) return null;
  const { doc, pricing } = load.delivery;
  const steps = freeDeliveryProgress({ doc, lines, country: place.country, state: place.state, pricing });
  if (steps.length === 0) return null;
  // What's left in QORT too, when the shop prices delivery in a currency.
  const inQort = (value: number) => (doc.currency !== "QORT" && pricing?.rates.QORT ? ` (about ${formatPrice(value / pricing.rates.QORT)} QORT)` : "");
  return (
    <Box
      role="status"
      aria-label="Free delivery"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        ...(framed && { px: 2, py: 1.5, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }),
      }}
    >
      {steps.map((step, i) => {
        const which = steps.length > 1 && step.profile ? ` (${step.profile})` : "";
        const offer = step.subtotal === 0 && lines.every((l) => !l.product || l.product.type === "digital");
        const text = step.reached
          ? `Free delivery to ${place.country}${which}`
          : offer
            ? `Free delivery to ${place.country} on orders from ${deliveryMoney(step.freeOver, step.currency)}`
            : `Add ${deliveryMoney(step.left, step.currency)}${inQort(step.left)} more for free delivery to ${place.country}${which}`;
        return (
          <Box key={`${step.profile ?? ""}-${i}`} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0.75,
                color: (theme) => (step.reached ? statusText(theme, "success") : theme.palette.text.primary),
              }}
            >
              <LocalShippingOutlinedIcon fontSize="small" aria-hidden sx={{ mt: 0.25 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }}>
                {text}
              </Typography>
            </Box>
            {!offer && (
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (step.subtotal / step.freeOver) * 100)}
                color={step.reached ? "success" : "primary"}
                aria-label={step.reached ? "Free delivery reached" : `${Math.round(Math.min(100, (step.subtotal / step.freeOver) * 100))}% of the way to free delivery`}
                sx={{ height: 8, borderRadius: 999 }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
