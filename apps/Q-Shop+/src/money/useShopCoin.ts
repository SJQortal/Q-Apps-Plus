/**
 * Which coin a shop's prices show in and are paid in, and its rate:
 * the buyer's preferred coin (Settings, or the last one picked) when the shop
 * takes it, otherwise QORT — as the original did for ARRR. The rate comes
 * from the shared cache (money/rates.ts); while it loads, converted prices
 * show "—".
 *
 * If the node can't give a rate (no recent trades of that coin), the coin
 * stays the buyer's choice: prices the seller set in that coin still show and
 * can be paid, and prices that would be converted from QORT say there is no
 * rate (`rateError`), with a message once per coin per minute. The original
 * fell back to QORT here; doing that through the preferred coin would also
 * have rewritten the buyer's Settings choice for every shop, since the
 * preferred coin is saved (state/store.ts).
 *
 * A Q-Asset has a rate when the shop gives it a price setting
 * (money/assetRates.ts: the trade portal's or the seller's own); without
 * one, only the seller's prices in the asset show, as before.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { setPreferredCoin } from "../state/features/storeSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { assetIdOf, coinLabel, shopCoins, type CoinId, type ShopCoinSettings } from "./coins";
import { cachedCoinRate, coinRate, needsRate, rateKey } from "./coinRate";
import type { AssetRate } from "./assetRates";

/**
 * Every price on screen uses this hook, so a failed rate would raise the same
 * message once per price: say it once per coin per minute.
 */
const lastRateNotice = new Map<string, number>();
const RATE_NOTICE_GAP_MS = 60_000;

function shouldNotify(coin: string): boolean {
  const last = lastRateNotice.get(coin) ?? 0;
  if (Date.now() - last < RATE_NOTICE_GAP_MS) return false;
  lastRateNotice.set(coin, Date.now());
  return true;
}

/** For tests. */
export function resetRateNotices(): void {
  lastRateNotice.clear();
}

export interface ShopCoin {
  /** Coins this shop takes, QORT first. */
  coins: CoinId[];
  /** The coin prices show in and checkout pays in. */
  coin: string;
  /** Foreign coin (or asset units) per QORT for `coin`; null for QORT, an asset without a price setting, while loading, or when the node has none. */
  rate: number | null;
  /** For an asset with a rate: QORT per unit and where it comes from, to say so beside prices. */
  assetRate: AssetRate | null;
  rateLoading: boolean;
  /**
   * The node couldn't give `coin`'s rate: prices converted from QORT can't be
   * shown or paid in `coin`; the seller's own prices in `coin` still can.
   */
  rateError: boolean;
  setCoin: (coin: string) => void;
}

interface RateState {
  coin: string;
  rate: number | null;
  asset?: AssetRate | null;
  failed: boolean;
}

export function useShopCoin(shop: ShopCoinSettings | null | undefined): ShopCoin {
  const dispatch = useDispatch();
  const preferred = useSelector((state: RootState) => state.store.preferredCoin);
  const coins = useMemo(() => shopCoins(shop), [shop]);
  const coin = (coins as string[]).includes(preferred) ? preferred : "QORT";
  const needs = needsRate(coin, shop);
  // Keyed by the coin and an asset's price setting, so a changed setting reads again.
  const key = rateKey(coin, shop);
  const [rateState, setRateState] = useState<RateState>(() => ({ coin: key, ...(cachedCoinRate(coin, shop) ?? { rate: null }), failed: false }));
  const current: RateState = rateState.coin === key ? rateState : { coin: key, ...(cachedCoinRate(coin, shop) ?? { rate: null }), failed: false };
  const rate = needs ? current.rate : null;
  const rateError = needs && rate === null && current.failed;
  const label = coinLabel(coin, shop);
  const isAsset = assetIdOf(coin) !== null;
  const shopRef = useRef(shop);
  useEffect(() => {
    shopRef.current = shop;
  });

  useEffect(() => {
    if (!needs) return;
    let alive = true;
    coinRate(coin, shopRef.current).then(
      (value) => {
        if (alive) setRateState({ coin: key, rate: value.rate, asset: value.asset, failed: false });
      },
      () => {
        if (!alive) return;
        // Keep the buyer's coin (never write a fallback into the saved preference).
        setRateState({ coin: key, rate: null, failed: true });
        if (shouldNotify(coin)) {
          dispatch(
            setNotification({
              alertType: "error",
              msg: isAsset
                ? `The Q-Assets trade portal has no ${label} price on your node right now. Prices the seller set in ${label} still show; other prices can't be paid in ${label}.`
                : `Your node has no ${coin} exchange rate right now. Prices the seller set in ${coin} still show; other prices can't be paid in ${coin}.`,
            })
          );
        }
      }
    );
    return () => {
      alive = false;
    };
  }, [coin, key, needs, isAsset, label, dispatch]);

  const setCoin = useCallback((next: string) => dispatch(setPreferredCoin(next)), [dispatch]);
  return { coins, coin, rate, assetRate: (needs && current.asset) || null, rateLoading: needs && rate === null && !rateError, rateError, setCoin };
}
