/**
 * Which coin a shop's prices show in (and checkout pays in), and the rate
 * used when a price is converted from QORT. The coin, the rate and the
 * conversion all come from money/ (useShopCoin, pricing); this only shows them.
 */
import { TextField, Typography, MenuItem } from "@mui/material";
import { coinLabel, isForeignTicker, type ShopCoinSettings } from "../../money/coins";
import { formatPrice } from "../../money/pricing";
import type { ShopCoin } from "../../money/useShopCoin";
import { selectMenuProps } from "../../components/common/menuStyle";

export function CoinPicker({ shop, shopCoin, id = "shop-coin" }: { shop: ShopCoinSettings | null | undefined; shopCoin: ShopCoin; id?: string }) {
  if (shopCoin.coins.length <= 1) return null;
  return (
    <TextField
      select
      id={id}
      size="small"
      label="Prices in"
      value={shopCoin.coin}
      onChange={(event) => shopCoin.setCoin(event.target.value)}
      slotProps={{ select: { MenuProps: selectMenuProps } }}
      sx={{ minWidth: 120, "& .MuiInputBase-root": { minHeight: 44 } }}
    >
      {shopCoin.coins.map((coin) => (
        <MenuItem key={coin} value={coin}>
          {coinLabel(coin, shop)}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** "1 QORT ≈ 0.25 ARRR · Trade Portal rate" while prices are converted from QORT. */
export function RateNote({ shopCoin }: { shopCoin: ShopCoin }) {
  const { coin, rate, rateLoading, rateError } = shopCoin;
  if (!isForeignTicker(coin)) return null;
  if (rateError) {
    return (
      <Typography variant="body2" color="text.secondary" role="status">
        Your node has no {coin} exchange rate right now. Prices the seller set in {coin} still show.
      </Typography>
    );
  }
  return (
    <Typography variant="body2" color="text.secondary" role="status">
      {rateLoading || !rate
        ? `Getting the ${coin} rate from your node…`
        : `1 QORT ≈ ${formatPrice(rate)} ${coin} · Trade Portal rate`}
    </Typography>
  );
}
