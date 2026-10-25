/**
 * A product's price in every coin its shop takes (Simon, 2026-10-24: "if
 * there are 2 or 3 coins accepted by the shop, I would like to see the prices
 * in all 3 currencies on the product pages, if there are more, make the extra
 * ones a dropdown"). The buyer's coin comes first and large (checkout pays in
 * it), the others follow; past three, the rest are in a menu. A coin the
 * product has no price in (an asset the seller didn't price it in) isn't
 * listed. Every price is checkout's own (money/pricing.ts): ARRR converted
 * from QORT uses the node's rate (money/rates.ts) and shows "—" until it is in.
 */
import { useEffect, useState } from "react";
import { Box, Button, Chip, Popover, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { AmountTag } from "./PriceTag";
import { isForeignTicker, shopCoins, type ShopCoinSettings } from "../../money/coins";
import { formatPrice, ownPrice, unitPrice, type PricedProduct } from "../../money/pricing";
import { cachedRate, getRate } from "../../money/rates";
import { dropdownPaperSx } from "../common/menuStyle";
import { saleOf } from "../../sale/compareAt";

/** Prices shown side by side; the rest go in the menu. */
export const INLINE_PRICES = 3;

type Rates = Record<string, number | null | "failed">;

/** The rate of each foreign coin among `coins`: a number, null while it loads, "failed" when the node has none. */
function useRates(coins: readonly string[]): Rates {
  const wanted = coins.filter(isForeignTicker).join("|");
  const [rates, setRates] = useState<Rates>(() => Object.fromEntries(wanted ? wanted.split("|").map((c) => [c, cachedRate(c)]) : []));
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    for (const coin of wanted.split("|")) {
      getRate(coin).then(
        (rate) => alive && setRates((prev) => ({ ...prev, [coin]: rate })),
        () => alive && setRates((prev) => ({ ...prev, [coin]: "failed" }))
      );
    }
    return () => {
      alive = false;
    };
  }, [wanted]);
  return rates;
}

/** The coins to show, the buyer's first, each with its price (undefined while a rate loads). */
export function pricedCoins(
  product: PricedProduct | null | undefined,
  shop: ShopCoinSettings | null | undefined,
  preferred: string,
  rates: Rates
): { coin: string; value: number | undefined; converted: boolean }[] {
  const coins: string[] = shopCoins(shop);
  const ordered = coins.includes(preferred) ? [preferred, ...coins.filter((c) => c !== preferred)] : coins;
  const out: { coin: string; value: number | undefined; converted: boolean }[] = [];
  for (const coin of ordered) {
    const rate = rates[coin];
    const value = unitPrice(product, coin, typeof rate === "number" ? rate : null);
    // An asset needs the seller's own price; ARRR can always be converted from QORT.
    if (value === undefined && !isForeignTicker(coin) && coin !== "QORT") continue;
    out.push({ coin, value, converted: isForeignTicker(coin) && !ownPrice(product, coin) });
  }
  return out;
}

export function ShopPrices({ product, shop, preferred }: { product: PricedProduct | null | undefined; shop: ShopCoinSettings | null | undefined; preferred: string }) {
  const rates = useRates(shopCoins(shop));
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const prices = pricedCoins(product, shop, preferred, rates);
  const [first, ...others] = prices;
  const inline = others.slice(0, INLINE_PRICES - 1);
  const extra = others.slice(INLINE_PRICES - 1);
  // A converted price says which rate it used (or that the node has none).
  const notes = prices
    .filter((p) => p.converted)
    .map((p) => {
      const rate = rates[p.coin];
      if (rate === "failed") return `Your node has no ${p.coin} exchange rate right now.`;
      if (typeof rate !== "number") return `Getting the ${p.coin} rate from your node…`;
      return `${p.coin} at the Trade Portal rate: 1 QORT ≈ ${formatPrice(rate)} ${p.coin}.`;
    });

  if (!first) return null;
  // On sale (sale/compareAt.ts): its price before, crossed out, and what buyers save.
  const sale = saleOf(product as Parameters<typeof saleOf>[0]);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
      {sale && (
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Chip size="small" color="error" label={`${sale.percent}% off`} sx={{ fontWeight: 700 }} />
          <Typography variant="body2" color="text.secondary">
            Was{" "}
            <Box component="s" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {formatPrice(sale.was.value)} {sale.was.currency === "QORT" ? "QORT" : sale.was.currency}
            </Box>
          </Typography>
        </Box>
      )}
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 2.5, rowGap: 1 }}>
        <AmountTag value={first.value} coin={first.coin} shop={shop} size="large" />
        {inline.length > 0 && (
          <Box component="ul" aria-label="Also priced in" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 2, rowGap: 0.5 }}>
            {inline.map((p) => (
              <Box component="li" key={p.coin}>
                <AmountTag value={p.value} coin={p.coin} shop={shop} sx={{ color: "text.secondary" }} />
              </Box>
            ))}
          </Box>
        )}
        {extra.length > 0 && (
          <>
            <Button
              color="inherit"
              endIcon={<ExpandMoreIcon />}
              aria-haspopup="dialog"
              aria-expanded={menu ? true : undefined}
              onClick={(event) => setMenu(event.currentTarget)}
              sx={{ minHeight: 44 }}
            >
              {`${extra.length} more price${extra.length === 1 ? "" : "s"}`}
            </Button>
            <Popover
              anchorEl={menu}
              open={!!menu}
              onClose={() => setMenu(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              slotProps={{ paper: { sx: dropdownPaperSx } }}
            >
              {/* Only prices to read: a list, not a menu of actions. */}
              <Box component="ul" aria-label="More prices" sx={{ listStyle: "none", m: 0, py: 1, px: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {extra.map((p) => (
                  <Box component="li" key={p.coin} sx={{ minHeight: 32, display: "flex", alignItems: "center" }}>
                    <AmountTag value={p.value} coin={p.coin} shop={shop} />
                  </Box>
                ))}
              </Box>
            </Popover>
          </>
        )}
      </Box>
      {notes.map((note) => (
        <Typography key={note} variant="body2" color="text.secondary" role="status">
          {note}
        </Typography>
      ))}
    </Box>
  );
}
