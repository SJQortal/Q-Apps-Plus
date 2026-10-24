/**
 * Every shop's cart priced at once, as each shop's own cart prices it: in
 * the buyer's preferred coin when the shop takes it, otherwise QORT
 * (money/useShopCoin.ts), with the node's rate for a foreign coin
 * (money/rates.ts, cached and shared). For the cart's summary and for
 * checking out several shops together; the amounts come from the checkout
 * service itself (cartLines.ts priceLines).
 */
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../state/store";
import type { CartLine } from "../../money/order";
import { coinLabel, isForeignTicker, shopCoins } from "../../money/coins";
import { cachedRate, getRate } from "../../money/rates";
import { checkoutBlock, checkoutLinesOf, isLeftOut, priceLines, type CartShop, type PricedLines } from "./cartLines";
import type { ShopCartView } from "./useCartData";

export interface ShopPricing {
  view: ShopCartView;
  /** The shop, once loaded. */
  shop: CartShop | null;
  title: string;
  coin: string;
  rate: number | null;
  lines: CartLine[];
  leftOut: number;
  priced: PricedLines;
  /** Why it can't be checked out now (cartLines.ts checkoutBlock), or a price problem; undefined when it can. */
  blocked?: string;
}

/** The coin a shop's prices show in and are paid in: the preferred coin when the shop takes it, else QORT. */
export function coinForShop(shop: CartShop | null, preferred: string): string {
  return (shopCoins(shop) as string[]).includes(preferred) ? preferred : "QORT";
}

type RateEntry = { rate: number | null; failed: boolean };

export function useCartPricing(views: ShopCartView[]): ShopPricing[] {
  const preferred = useSelector((state: RootState) => state.store.preferredCoin);
  const coins = useMemo(() => views.map((view) => coinForShop(view.shop, preferred)), [views, preferred]);
  const needed = useMemo(() => [...new Set(coins.filter(isForeignTicker))].sort(), [coins]);
  const neededKey = needed.join(",");
  const [rates, setRates] = useState<Record<string, RateEntry>>({});

  useEffect(() => {
    let alive = true;
    for (const coin of neededKey ? neededKey.split(",") : []) {
      getRate(coin).then(
        (rate) => alive && setRates((prev) => ({ ...prev, [coin]: { rate, failed: false } })),
        () => alive && setRates((prev) => ({ ...prev, [coin]: { rate: null, failed: true } }))
      );
    }
    return () => {
      alive = false;
    };
  }, [neededKey]);

  return useMemo(
    () =>
      views.map((view, i) => {
        const coin = coins[i];
        const foreign = isForeignTicker(coin);
        const entry = rates[coin];
        // The shared cache while it's fresh (5 minutes), else this page's last read; Confirm reads again.
        const rate = foreign ? (cachedRate(coin) ?? entry?.rate ?? null) : null;
        const failed = foreign && rate === null && !!entry?.failed;
        const lines = checkoutLinesOf(view.lines);
        const priced = priceLines(lines, coin, rate, foreign && rate === null && !failed, failed);
        const label = coinLabel(coin, view.shop);
        const blocked =
          checkoutBlock(view) ??
          (priced.ok
            ? undefined
            : priced.reason === "rate"
              ? `Getting the ${label} rate…`
              : priced.reason === "no-rate"
                ? `No ${label} rate on your node right now.`
                : `Some items have no price in ${label}.`);
        return {
          view,
          shop: view.shop,
          title: view.shop?.title || view.knownTitle || view.owner || "Shop",
          coin,
          rate,
          lines,
          leftOut: view.lines.filter(isLeftOut).length,
          priced,
          blocked,
        };
      }),
    [views, coins, rates]
  );
}
