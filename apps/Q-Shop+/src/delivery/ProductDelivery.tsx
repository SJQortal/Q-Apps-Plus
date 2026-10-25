/**
 * A product page's delivery (estimate.ts): what delivery costs to the
 * buyer's country, each option the shop offers there with its price for the
 * quantity chosen, and where the shop ships, before anything goes in the
 * cart. The shop's delivery prices are one read per shop (none for most
 * shops, which a cached search says), cached for the session; a shop
 * without them says where it ships, as before.
 */
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Box, Button, Skeleton, Typography } from "@mui/material";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import type { RootState } from "../state/store";
import type { CartLine } from "../money/order";
import { formatPrice } from "../money/pricing";
import { AmountTag } from "../components/money/PriceTag";
import { ShippingCountriesButton } from "../pages/Store/ShippingCountries";
import { placeNotShipped } from "../constants/shipping";
import { useShopDelivery } from "./useShopDelivery";
import { deliveryEstimate, type EstimateChoice } from "./estimate";
import { statusText } from "../theme/statusText";
import { placeLabel, useBuyerPlace } from "./buyerPlace";

const PlacePickerDialog = lazy(() => import("./PlacePickerDialog").then((m) => ({ default: m.PlacePickerDialog })));

export interface DeliveryShop {
  title?: string;
  location?: unknown;
  shipsTo?: unknown;
  supportedCoins?: unknown;
  shippingCountries?: unknown;
  shippingStates?: unknown;
}

const money = (value: number, currency: string) => `${formatPrice(value)} ${currency}`;

/** An option's price: QORT (every shop takes it), with the seller's own currency under it; or Free. */
function Price({ choice, inline = false }: { choice: EstimateChoice; inline?: boolean }) {
  if (choice.free) return <Typography sx={{ fontWeight: 700, color: (theme) => statusText(theme, "success") }}>Free</Typography>;
  return (
    <Box sx={inline ? { display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 1 } : { textAlign: "right", flexShrink: 0 }}>
      {choice.qort !== undefined ? <AmountTag value={choice.qort} coin="QORT" size={inline ? "medium" : "small"} /> : null}
      {choice.fiat && (
        <Typography variant="body2" color="text.secondary">
          {money(choice.fiat.value, choice.fiat.currency)}
        </Typography>
      )}
    </Box>
  );
}

export function ProductDelivery({ owner, storeId, shop, line }: { owner: string; storeId: string; shop: DeliveryShop | null | undefined; line: CartLine }) {
  const buyer = useSelector((state: RootState) => state.auth.user?.name);
  const place = useBuyerPlace(buyer);
  const [picking, setPicking] = useState(false);
  const load = useShopDelivery(owner, storeId);
  const delivery = load.status === "ready" ? load.delivery : undefined;
  const shipsTo = typeof shop?.shipsTo === "string" ? shop.shipsTo.trim() : "";
  const hasPrices = !!delivery?.doc;

  // Where it comes from (the shop's own words), and where the shop ships.
  const from = typeof shop?.location === "string" ? shop.location.trim() : "";
  const shipsToLine =
    shipsTo || from ? (
      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
        {from && `Ships from ${from}${shipsTo ? " · " : ""}`}
        {shipsTo && (
          <>
            {from ? "to" : "Ships to"} {shipsTo} <ShippingCountriesButton shop={{ ...(shop ?? {}), title: shop?.title }} />
          </>
        )}
      </Typography>
    ) : null;

  // No delivery prices: where it ships, as before, and whether that's the buyer's country.
  if (load.status === "ready" && !hasPrices) {
    if (!shipsToLine) return null;
    const notShipped = place ? placeNotShipped(shop, place.country, place.state) : null;
    return (
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, color: "text.secondary" }}>
        <LocalShippingOutlinedIcon fontSize="small" aria-hidden sx={{ mt: 0.25 }} />
        <Box sx={{ minWidth: 0 }}>
          {shipsToLine}
          {notShipped && (
            <Typography variant="body2" sx={{ color: (theme) => statusText(theme, "warning"), fontWeight: 600 }}>
              Doesn't ship to {notShipped}.
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  const estimate = delivery && place ? deliveryEstimate({ shop: shop ?? {}, delivery, lines: [line], place }) : null;
  const heading = place ? `Delivery to ${placeLabel(place)}` : "Delivery";
  const options = estimate?.kind === "ok" && estimate.choices.some((c) => c.name);
  let body: ReactNode;
  if (load.status === "loading") {
    body = <Skeleton width="60%" aria-label="Reading delivery prices" />;
  } else if (load.status === "failed") {
    body = (
      <Typography variant="body2" color="text.secondary">
        Delivery prices couldn't be read from your node right now; checkout works them out.
      </Typography>
    );
  } else if (!place) {
    body = (
      <Typography variant="body2" color="text.secondary">
        Choose your country to see what delivery costs{delivery?.doc?.options?.length ? ", and the options the shop offers" : ""}.
      </Typography>
    );
  } else if (estimate?.kind === "not-shipped") {
    body = (
      <Typography variant="body2" sx={{ color: (theme) => statusText(theme, "warning"), fontWeight: 600 }}>
        {shop?.title || "This shop"} doesn't ship to {estimate.place}.
      </Typography>
    );
  } else if (estimate?.kind === "unavailable") {
    body = (
      <Typography variant="body2" sx={{ color: (theme) => statusText(theme, "warning"), fontWeight: 600 }}>
        This product isn't delivered to {estimate.place}. Ask the seller.
      </Typography>
    );
  } else if (estimate?.kind === "no-rates") {
    body = (
      <Typography variant="body2" color="text.secondary">
        Delivery prices can't be worked out right now. Ask the seller.
      </Typography>
    );
  } else if (estimate?.kind === "ok") {
    body = (
      <>
        {options ? (
          // Checkout's choice, priced here: the buyer picks one there.
          <Box component="ul" aria-label="Delivery options" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            {estimate.choices.map((choice) => (
              <Box component="li" key={choice.id || "base"} sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{choice.name}</Typography>
                  {choice.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                      {choice.note}
                    </Typography>
                  )}
                </Box>
                <Price choice={choice} />
              </Box>
            ))}
          </Box>
        ) : (
          estimate.choices[0] && <Price choice={estimate.choices[0]} inline />
        )}
        {estimate.freeOver && !estimate.choices.every((c) => c.free) && (
          <Typography variant="body2" color="text.secondary">
            Free delivery once this shop's items in your order reach {money(estimate.freeOver.value, estimate.freeOver.currency)}.
          </Typography>
        )}
      </>
    );
  }

  const counted = line.quantity > 1 && place && estimate?.kind === "ok";
  return (
    <Box component="section" aria-label={`${heading}${counted ? `, for ${line.quantity}` : ""}`} sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1 }}>
        <LocalShippingOutlinedIcon fontSize="small" aria-hidden sx={{ color: "text.secondary" }} />
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16, flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>
          {heading}
          {counted && (
            <Box component="span" sx={{ fontWeight: 400, color: "text.secondary" }}>
              {` · for ${line.quantity}`}
            </Box>
          )}
        </Typography>
        {load.status === "ready" && (
          <Button size="small" onClick={() => setPicking(true)} aria-haspopup="dialog" sx={{ minHeight: 44 }}>
            {place ? "Change" : "Choose your country"}
          </Button>
        )}
      </Box>
      {body}
      {shipsToLine}
      {picking && (
        <Suspense fallback={null}>
          <PlacePickerDialog place={place} onClose={() => setPicking(false)} />
        </Suspense>
      )}
    </Box>
  );
}
