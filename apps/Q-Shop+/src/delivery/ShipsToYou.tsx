/**
 * Whether the shop ships to the buyer's country (buyerPlace.ts), under its
 * "Ships to": "Ships to Portugal", or "Doesn't ship to Portugal" when its
 * list leaves it out. A shop from before the list says so only when its
 * typed words name the country, its region or the world.
 */
import { useSelector } from "react-redux";
import { Typography } from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import DoNotDisturbOnOutlinedIcon from "@mui/icons-material/DoNotDisturbOnOutlined";
import type { RootState } from "../state/store";
import { countryCode, placeNotShipped, shippingCountriesOf } from "../constants/shipping";
import { shopShipsTo } from "../discovery/sortFilter";
import { placeLabel, useBuyerPlace } from "./buyerPlace";
import { statusText } from "../theme/statusText";

export function ShipsToYou({ shop }: { shop: { shippingCountries?: unknown; shippingStates?: unknown; shipsTo?: unknown } | null | undefined }) {
  const buyer = useSelector((state: RootState) => state.auth.user?.name);
  const place = useBuyerPlace(buyer);
  if (!place || !shop) return null;
  const code = countryCode(place.country);
  let ships: boolean | null = null;
  if (shippingCountriesOf(shop)) ships = !placeNotShipped(shop, place.country, place.state);
  else if (code && shopShipsTo(shop, code)) ships = true;
  if (ships === null) return null;
  return (
    <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, color: (theme) => statusText(theme, ships ? "success" : "warning"), fontWeight: 600 }}>
      {ships ? <CheckCircleOutlineIcon fontSize="small" aria-hidden /> : <DoNotDisturbOnOutlinedIcon fontSize="small" aria-hidden />}
      <span>{ships ? `Ships to ${placeLabel(place)}` : `Doesn't ship to ${placeLabel(place)}`}</span>
    </Typography>
  );
}
