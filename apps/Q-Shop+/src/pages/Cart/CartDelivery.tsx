/**
 * A shop's cart says what delivery adds before checkout (delivery/estimate.ts):
 * "Delivery to Portugal: 2.00 QORT", "from 2.00 QORT · 3 options", free, or
 * that the shop doesn't ship there; without the buyer's country, that it's
 * added at checkout, with a way to see it. Nothing for a shop without
 * delivery prices, or a cart of digital products.
 */
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Box, Button, Typography } from "@mui/material";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import type { RootState } from "../../state/store";
import type { CartLine } from "../../money/order";
import { formatPrice } from "../../money/pricing";
import { AmountTag } from "../../components/money/PriceTag";
import { useShopDelivery } from "../../delivery/useShopDelivery";
import { deliveryEstimate } from "../../delivery/estimate";
import type { DeliveryShop } from "../../delivery/ProductDelivery";
import { placeLabel, useBuyerPlace } from "../../delivery/buyerPlace";
import { statusText } from "../../theme/statusText";

const PlacePickerDialog = lazy(() => import("../../delivery/PlacePickerDialog").then((m) => ({ default: m.PlacePickerDialog })));

export function CartDelivery({ owner, storeId, shop, lines }: { owner: string; storeId: string; shop: DeliveryShop | null | undefined; lines: readonly CartLine[] }) {
  const buyer = useSelector((state: RootState) => state.auth.user?.name);
  const place = useBuyerPlace(buyer);
  const [picking, setPicking] = useState(false);
  const physical = lines.some((l) => l.product && l.product.type !== "digital");
  // A node that can't serve them now: checkout works them out (and says so).
  const load = useShopDelivery(owner, storeId, physical);
  const delivery = load.status === "ready" ? load.delivery : undefined;
  if (!physical || !delivery?.doc) return null;

  const row = (children: ReactNode, tone?: "warning") => (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, color: (theme) => (tone === "warning" ? statusText(theme, "warning") : theme.palette.text.secondary) }}>
      <LocalShippingOutlinedIcon fontSize="small" aria-hidden sx={{ mt: 0.25 }} />
      <Box sx={{ minWidth: 0, display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 0.75 }}>{children}</Box>
    </Box>
  );
  const picker = picking && (
    <Suspense fallback={null}>
      <PlacePickerDialog place={place} onClose={() => setPicking(false)} />
    </Suspense>
  );

  if (!place) {
    return (
      <>
        {row(
          <>
            <Typography variant="body2">Delivery is added at checkout.</Typography>
            <Button size="small" onClick={() => setPicking(true)} aria-haspopup="dialog" sx={{ minHeight: 32, px: 0.75, ml: -0.75 }}>
              See it for your country
            </Button>
          </>
        )}
        {picker}
      </>
    );
  }
  const estimate = deliveryEstimate({ shop: shop ?? {}, delivery, lines, place });
  const where = placeLabel(place);
  if (estimate.kind === "not-shipped") return row(<Typography variant="body2" sx={{ fontWeight: 600 }}>{`${shop?.title || "This shop"} doesn't ship to ${estimate.place}.`}</Typography>, "warning");
  if (estimate.kind === "unavailable") return row(<Typography variant="body2" sx={{ fontWeight: 600 }}>{`Not everything here is delivered to ${estimate.place}.`}</Typography>, "warning");
  if (estimate.kind !== "ok" || estimate.choices.length === 0) return null;
  const several = estimate.choices.length > 1;
  // The cheapest paid option, and a free one (Local pickup, say), when there is one.
  const paid = estimate.choices.filter((c) => !c.free && c.qort !== undefined).sort((a, b) => (a.qort ?? 0) - (b.qort ?? 0))[0];
  const free = estimate.choices.find((c) => c.free);
  return (
    <>
      {row(
        <>
          <Typography variant="body2">{`Delivery to ${where}:`}</Typography>
          {free && (
            <Typography variant="body2" sx={{ fontWeight: 700, color: (theme) => statusText(theme, "success") }}>
              {several && free.name ? `free with ${free.name}` : "free"}
            </Typography>
          )}
          {free && paid && <Typography variant="body2">or</Typography>}
          {paid && (
            <>
              {several && <Typography variant="body2">from</Typography>}
              <AmountTag value={paid.qort} coin="QORT" size="small" />
            </>
          )}
          {several && <Typography variant="body2">{`· ${estimate.choices.length} options at checkout`}</Typography>}
          {estimate.freeOver && paid && (
            <Typography variant="body2">{`· free from ${formatPrice(estimate.freeOver.value)} ${estimate.freeOver.currency}`}</Typography>
          )}
          <Button size="small" onClick={() => setPicking(true)} aria-haspopup="dialog" aria-label={`Change the country (${where})`} sx={{ minHeight: 32, px: 0.75 }}>
            Change
          </Button>
        </>
      )}
      {picker}
    </>
  );
}
