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
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { setPreferredCoin } from "../state/features/storeSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { isForeignTicker, shopCoins, type CoinId, type ShopCoinSettings } from "./coins";
import { cachedRate, getRate } from "./rates";

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
  /** Foreign coin per QORT for `coin`; null for QORT, assets, while loading, or when the node has none. */
  rate: number | null;
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
  failed: boolean;
}

export function useShopCoin(shop: ShopCoinSettings | null | undefined): ShopCoin {
  const dispatch = useDispatch();
  const preferred = useSelector((state: RootState) => state.store.preferredCoin);
  const coins = useMemo(() => shopCoins(shop), [shop]);
  const coin = (coins as string[]).includes(preferred) ? preferred : "QORT";
  const needsRate = isForeignTicker(coin);
  const [rateState, setRateState] = useState<RateState>(() => ({
    coin,
    rate: needsRate ? cachedRate(coin) : null,
    failed: false,
  }));
  const current: RateState =
    rateState.coin === coin ? rateState : { coin, rate: needsRate ? cachedRate(coin) : null, failed: false };
  const rate = needsRate ? current.rate : null;
  const rateError = needsRate && rate === null && current.failed;

  useEffect(() => {
    if (!needsRate) return;
    let alive = true;
    getRate(coin).then(
      (value) => {
        if (alive) setRateState({ coin, rate: value, failed: false });
      },
      () => {
        if (!alive) return;
        // Keep the buyer's coin (never write a fallback into the saved preference).
        setRateState({ coin, rate: null, failed: true });
        if (shouldNotify(coin)) {
          dispatch(
            setNotification({
              alertType: "error",
              msg: `Your node has no ${coin} exchange rate right now. Prices the seller set in ${coin} still show; other prices can't be paid in ${coin}.`,
            })
          );
        }
      }
    );
    return () => {
      alive = false;
    };
  }, [coin, needsRate, dispatch]);

  const setCoin = useCallback((next: string) => dispatch(setPreferredCoin(next)), [dispatch]);
  return { coins, coin, rate, rateLoading: needsRate && rate === null && !rateError, rateError, setCoin };
}
