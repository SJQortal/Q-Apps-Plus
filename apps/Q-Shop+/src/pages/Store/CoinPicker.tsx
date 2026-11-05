/**
 * Which coin a shop's prices show in (and checkout pays in), and the rate
 * used when a price is converted from QORT. The coin, the rate and the
 * conversion all come from money/ (useShopCoin, pricing); this only shows them.
 */
import { TextField, Typography, MenuItem } from "@mui/material";
import { assetIdOf, coinLabel, isForeignTicker, type ShopCoinSettings } from "../../money/coins";
import { noRateText } from "../../money/coinRate";
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

/**
 * "1 QORT ≈ 0.25 ARRR · Trade Portal rate" while prices are converted from
 * QORT; for a Q-Asset, "1 BHC Coin ≈ 0.055 QORT · Q-Assets trade portal" (or
 * "· the shop's rate").
 */
export function RateNote({ shopCoin, shop }: { shopCoin: ShopCoin; shop?: ShopCoinSettings | null }) {
  const { coin, rate, rateLoading, rateError, assetRate } = shopCoin;
  const isAsset = assetIdOf(coin) !== null;
  if (!isForeignTicker(coin) && !(isAsset && (rate !== null || rateLoading || rateError))) return null;
  const label = coinLabel(coin, shop);
  if (rateError) {
    return (
      <Typography variant="body2" color="text.secondary" role="status">
        {noRateText(coin, label)}. Prices the seller set in {label} still show.
      </Typography>
    );
  }
  const source = assetRate?.source === "seller" ? "the shop's rate" : assetRate?.source === "offer" ? "Q-Assets trade portal, lowest offer" : "Q-Assets trade portal";
  return (
    <Typography variant="body2" color="text.secondary" role="status">
      {rateLoading || !rate
        ? `Getting the ${label} ${isAsset ? "price" : "rate"} from your node…`
        : isAsset && assetRate
          ? `1 ${label} ≈ ${formatPrice(assetRate.qort)} QORT · ${source}`
          : `1 QORT ≈ ${formatPrice(rate)} ${coin} · Trade Portal rate`}
    </Typography>
  );
}
